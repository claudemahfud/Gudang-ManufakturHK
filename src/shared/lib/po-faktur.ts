import { and, eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { inventory, logs, poLoading, poLoadingItems } from '@/shared/lib/db/schema';
import { catatBarangMasuk, catatPembayaranPembelian } from '@/shared/lib/barang-masuk';
import { BusinessError, normalizeSku } from '@/shared/lib/stock';
import { PO_STATUS } from '@/shared/lib/po-status';

// ============================================================
// Faktur Pembelian dari PO ("Barang Datang" di Barang Masuk).
// Wajib dipanggil di dalam db.transaction.
// ============================================================

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface FakturItemInput {
  itemId: string;
  qtyTerima: unknown;
  hargaBeli?: unknown;
}

export interface FakturInput {
  items: FakturItemInput[];
  noFaktur: string | null;
  tanggal: Date;
  skemaBayar: 'lunas' | 'hutang';
  jatuhTempo: Date | null;
  divisi: string;
  user: string;
  bolehHpp: boolean; // boleh menentukan harga beli; selain itu harga master
}

export async function terimaFakturPo(tx: Tx, poId: string, f: FakturInput) {
  // Kunci header PO: dua faktur bersamaan untuk PO yang sama antre
  const [po] = await tx.select().from(poLoading).where(eq(poLoading.id, poId)).for('update').limit(1);
  if (!po) throw new BusinessError('PO tidak ditemukan', 404);
  if (po.status === PO_STATUS.SELESAI) throw new BusinessError('Semua barang PO ini sudah diterima.');
  if (po.status === PO_STATUS.BATAL) throw new BusinessError('PO ini sudah dibatalkan.');
  if (!po.supplier) throw new BusinessError('PO tidak memiliki suplier.');

  const poItems = await tx.select().from(poLoadingItems).where(eq(poLoadingItems.poLoadingId, poId));
  const byId = new Map(poItems.map((it) => [it.id, it]));
  const seen = new Set<string>();

  let total = 0;
  const diterima: string[] = [];

  for (const input of f.items) {
    const it = byId.get(input.itemId);
    if (!it) throw new BusinessError('Barang faktur tidak ada di PO ini.');
    if (seen.has(it.id)) throw new BusinessError(`Barang ${it.namaBarang} tercantum dua kali di faktur.`);
    seen.add(it.id);

    const qty = Number(input.qtyTerima);
    if (!Number.isInteger(qty) || qty < 0) {
      throw new BusinessError(`Qty diterima ${it.namaBarang} harus bilangan bulat >= 0`);
    }
    if (qty === 0) continue;
    const sisa = it.qtyOrder - it.qtyTerima;
    if (qty > sisa) {
      throw new BusinessError(`Qty diterima ${it.namaBarang} (${qty}) melebihi sisa pesanan (${sisa}).`);
    }

    const sku = normalizeSku(it.sku);
    const [inv] = await tx
      .select({ hargaBeli: inventory.hargaBeli })
      .from(inventory)
      .where(eq(inventory.sku, sku))
      .limit(1);
    const hargaInput = Number(input.hargaBeli);
    const harga =
      f.bolehHpp && input.hargaBeli !== undefined && input.hargaBeli !== '' && Number.isFinite(hargaInput) && hargaInput >= 0
        ? hargaInput
        : Number(inv?.hargaBeli ?? 0) || 0;

    const { totalBeli } = await catatBarangMasuk(tx, {
      tanggal: f.tanggal,
      sku,
      namaBarang: it.namaBarang,
      qty,
      satuan: it.satuan,
      hargaBeli: harga,
      supplier: po.supplier,
      noFaktur: f.noFaktur ?? po.noPo, // sama dengan nomor hutang/jurnal pembeliannya
      skemaBayar: f.skemaBayar,
      jatuhTempo: f.jatuhTempo,
      divisi: f.divisi,
      cabang: po.cabang,
      keterangan: `Faktur pembelian dari ${po.noPo}`,
      user: f.user,
    });
    total += totalBeli;
    diterima.push(`${it.namaBarang} (${sku}) x${qty} ${it.satuan}`);

    await tx
      .update(poLoadingItems)
      .set({ qtyTerima: it.qtyTerima + qty })
      .where(and(eq(poLoadingItems.id, it.id), eq(poLoadingItems.poLoadingId, poId)));
    it.qtyTerima += qty;
  }

  if (diterima.length === 0) throw new BusinessError('Isi minimal satu barang yang diterima.');

  await catatPembayaranPembelian(tx, {
    tanggal: f.tanggal,
    total,
    supplier: po.supplier,
    noFaktur: f.noFaktur ?? po.noPo,
    skemaBayar: f.skemaBayar,
    jatuhTempo: f.jatuhTempo,
    divisi: f.divisi,
    cabang: po.cabang,
    uraian: `${po.noPo}: ${diterima.join(', ')}`,
    user: f.user,
  });

  const lengkap = poItems.every((it) => it.qtyTerima >= it.qtyOrder);
  const status = lengkap ? PO_STATUS.SELESAI : PO_STATUS.SEBAGIAN;
  await tx.update(poLoading).set({ status, updatedAt: new Date() }).where(eq(poLoading.id, poId));

  await tx.insert(logs).values({
    user: f.user,
    aksi: 'FAKTUR_PEMBELIAN_PO',
    detail: `Faktur ${f.noFaktur || '-'} dari ${po.noPo} (${po.supplier}) [${f.skemaBayar.toUpperCase()}] Rp ${total.toLocaleString('id-ID')}: ${diterima.join(', ')}. Status PO: ${status}`,
  });

  return {
    noPo: po.noPo,
    supplier: po.supplier,
    noFaktur: f.noFaktur,
    status,
    total,
    items: poItems.map((it) => ({ sku: normalizeSku(it.sku), namaBarang: it.namaBarang })),
  };
}
