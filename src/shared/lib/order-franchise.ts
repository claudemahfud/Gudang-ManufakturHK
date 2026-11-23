import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import {
  barangMasuk,
  fakturPenjualan,
  inventory,
  logs,
  masterCabang,
  orderFranchise,
  orderFranchiseItems,
  stokCabang,
} from '@/shared/lib/db/schema';
import { BusinessError, incrementStock, normalizeSku, parsePositiveInt } from '@/shared/lib/stock';
import { batalkanFakturPenjualan, buatFakturPenjualan } from '@/shared/lib/faktur-penjualan';
import { DAPUR_PUSAT } from '@/shared/lib/dapur-pusat';
import { generateTrxId } from '@/shared/lib/utils';

// ============================================================
// Order Franchise -> Dapur Pusat.
// diajukan -> dikirim (faktur tempo, stok Pusat turun) -> diterima (stok franchise naik)
// atau ditolak / dibatalkan. Lihat docs/PRD-dapur-pusat-franchise.md (F3).
// ============================================================

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

export type StatusOrder = 'diajukan' | 'dikirim' | 'diterima' | 'ditolak' | 'dibatalkan';
export const TEMPO_DEFAULT_HARI = 14;

export interface Pelaku {
  username: string;
  role?: string;
  cabang?: string;
}

const PIMPINAN = ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum'];

/** Tim Dapur Pusat: pimpinan, atau pengguna yang ditempatkan di Pusat / ALL. */
export function isTimPusat(u: Pelaku) {
  return PIMPINAN.includes(u.role ?? '') || !u.cabang || u.cabang === 'Pusat' || u.cabang === 'ALL';
}

/** Franchise yang boleh dilihat pengguna: null = semua (tim pusat), selain itu hanya cabangnya. */
export function franchiseTerlihat(u: Pelaku): string | null {
  return isTimPusat(u) ? null : (u.cabang as string);
}

async function pastikanFranchise(ex: Executor, nama: string) {
  const [c] = await ex
    .select({ tipe: masterCabang.tipe, status: masterCabang.status })
    .from(masterCabang)
    .where(eq(masterCabang.namaCabang, nama))
    .limit(1);
  if (!c || c.tipe !== 'FRANCHISE') throw new BusinessError(`${nama} bukan outlet franchise terdaftar`);
  if (c.status !== 'ACTIVE') throw new BusinessError(`Outlet franchise ${nama} tidak aktif`);
}

/** Produk yang bisa dipesan franchise: F&B dengan harga franchise > 0, plus stok Dapur Pusat. */
export async function katalogFranchise(ex: Executor = db) {
  const rows = await ex
    .select({
      sku: inventory.sku,
      namaBarang: inventory.namaBarang,
      brand: inventory.brand,
      hargaFranchise: inventory.hargaFranchise,
      hargaJual: inventory.hargaJual,
      stokPusat: stokCabang.stok,
    })
    .from(inventory)
    .leftJoin(stokCabang, and(eq(stokCabang.sku, inventory.sku), eq(stokCabang.cabang, DAPUR_PUSAT)))
    .where(eq(inventory.divisi, 'FNB'));
  return rows
    .filter((r) => Number(r.hargaFranchise) > 0)
    .map((r) => ({ ...r, hargaFranchise: Number(r.hargaFranchise), hargaJual: Number(r.hargaJual ?? 0), stokPusat: r.stokPusat ?? 0 }))
    .sort((a, b) => a.namaBarang.localeCompare(b.namaBarang));
}

export async function buatOrder(
  tx: Tx,
  o: { franchise: string; items: { sku: unknown; qty: unknown }[]; catatan: string | null },
  u: Pelaku
) {
  await pastikanFranchise(tx, o.franchise);
  if (!Array.isArray(o.items) || o.items.length === 0) throw new BusinessError('Order kosong');

  const qtyPerSku = new Map<string, number>();
  for (const it of o.items) {
    const sku = normalizeSku(it?.sku);
    const qty = parsePositiveInt(it?.qty);
    if (!sku || !qty) throw new BusinessError('SKU dan jumlah order wajib valid');
    qtyPerSku.set(sku, (qtyPerSku.get(sku) ?? 0) + qty);
  }
  const skus = [...qtyPerSku.keys()];
  const master = await tx
    .select({ sku: inventory.sku, namaBarang: inventory.namaBarang, divisi: inventory.divisi, hargaFranchise: inventory.hargaFranchise })
    .from(inventory)
    .where(inArray(inventory.sku, skus));

  const baris = skus.map((sku) => {
    const m = master.find((x) => x.sku === sku);
    if (!m) throw new BusinessError(`Produk ${sku} tidak ditemukan`, 404);
    const harga = Number(m.hargaFranchise);
    if (m.divisi !== 'FNB' || !(harga > 0)) throw new BusinessError(`${m.namaBarang} tidak dijual ke franchise`);
    const qty = qtyPerSku.get(sku)!;
    return { sku, namaBarang: m.namaBarang, qty, harga, subtotal: Math.round(qty * harga * 100) / 100 };
  });
  const total = Math.round(baris.reduce((s, b) => s + b.subtotal, 0) * 100) / 100;

  const [order] = await tx
    .insert(orderFranchise)
    .values({
      noOrder: generateTrxId('OF'),
      tanggal: new Date(),
      franchise: o.franchise,
      status: 'diajukan',
      total: String(total),
      catatan: o.catatan,
      createdBy: u.username,
    })
    .returning();
  await tx.insert(orderFranchiseItems).values(
    baris.map((b) => ({ orderId: order.id, sku: b.sku, namaBarang: b.namaBarang, qty: b.qty, harga: String(b.harga), subtotal: String(b.subtotal) }))
  );
  await tx.insert(logs).values({
    user: u.username,
    aksi: 'ORDER_FRANCHISE',
    detail: `Order ${order.noOrder} dari ${o.franchise}: ${baris.length} produk, total Rp ${total.toLocaleString('id-ID')}`,
  });
  return order;
}

/** Ambil & kunci order; pastikan pelaku boleh melihatnya. */
async function kunciOrder(tx: Tx, id: string, u: Pelaku) {
  const [order] = await tx.select().from(orderFranchise).where(eq(orderFranchise.id, id)).for('update').limit(1);
  const lingkup = franchiseTerlihat(u);
  if (!order || (lingkup && order.franchise !== lingkup)) throw new BusinessError('Order tidak ditemukan', 404);
  const items = await tx.select().from(orderFranchiseItems).where(eq(orderFranchiseItems.orderId, id));
  return { order, items };
}

function wajibStatus(order: { status: string; noOrder: string }, ...boleh: StatusOrder[]) {
  if (!boleh.includes(order.status as StatusOrder))
    throw new BusinessError(`Order ${order.noOrder} berstatus ${order.status}, aksi ini tidak bisa dilakukan`);
}

function wajibPusat(u: Pelaku) {
  if (!isTimPusat(u)) throw new BusinessError('Hanya tim Dapur Pusat yang bisa melakukan aksi ini', 403);
}

/** Dapur Pusat mengirim: terbit faktur tempo ke franchise, stok Pusat berkurang. */
export async function kirimOrder(tx: Tx, id: string, u: Pelaku, tempoHari = TEMPO_DEFAULT_HARI) {
  wajibPusat(u);
  const { order, items } = await kunciOrder(tx, id, u);
  wajibStatus(order, 'diajukan');
  const [cabang] = await tx
    .select({ alamat: masterCabang.alamat, telepon: masterCabang.telepon })
    .from(masterCabang)
    .where(eq(masterCabang.namaCabang, order.franchise))
    .limit(1);

  const tanggal = new Date();
  const hari = Number.isInteger(tempoHari) && tempoHari >= 0 && tempoHari <= 365 ? tempoHari : TEMPO_DEFAULT_HARI;
  const noFaktur = generateTrxId('FJ');
  await buatFakturPenjualan(tx, {
    noFaktur,
    tanggal,
    jatuhTempo: new Date(tanggal.getTime() + hari * 24 * 60 * 60 * 1000),
    pelanggan: order.franchise,
    pelangganId: null,
    telepon: cabang?.telepon ?? null,
    alamat: cabang?.alamat ?? null,
    salesman: null,
    baris: items.map((i) => ({ sku: i.sku, qty: i.qty, hargaJual: Number(i.harga), diskon: 0, satuan: 'pcs' as const })),
    diskonFaktur: 0,
    ppnPersen: 0,
    ongkir: 0,
    metodeBayar: 'tempo',
    dibayar: 0,
    divisi: 'FNB',
    cabang: DAPUR_PUSAT,
    catatan: `Order franchise ${order.noOrder}`,
    user: u.username,
  });
  const [baru] = await tx
    .update(orderFranchise)
    .set({ status: 'dikirim', noFaktur, dikirimBy: u.username, dikirimAt: tanggal })
    .where(eq(orderFranchise.id, id))
    .returning();
  await tx.insert(logs).values({
    user: u.username,
    aksi: 'KIRIM_ORDER_FRANCHISE',
    detail: `Order ${order.noOrder} ke ${order.franchise} dikirim, faktur tempo ${noFaktur} Rp ${Number(order.total).toLocaleString('id-ID')} (${hari} hari)`,
  });
  return baru;
}

/** Franchise menerima: stok outlet bertambah dan tercatat sebagai barang masuk outlet. */
export async function terimaOrder(tx: Tx, id: string, u: Pelaku) {
  const { order, items } = await kunciOrder(tx, id, u);
  wajibStatus(order, 'dikirim');
  const tanggal = new Date();
  for (const i of items) {
    await incrementStock(tx, i.sku, i.qty, order.franchise);
    // Langsung ke barang_masuk (bukan catatBarangMasuk): harga beli master tetap HPP Dapur Pusat,
    // tagihan sudah tercatat sebagai faktur piutang Pusat, bukan hutang supplier.
    await tx.insert(barangMasuk).values({
      tanggal,
      sku: i.sku,
      namaBarang: i.namaBarang,
      qty: i.qty,
      satuan: 'pcs',
      hargaBeli: String(i.harga),
      totalBeli: String(i.subtotal),
      supplier: 'Dapur Pusat',
      noFaktur: order.noFaktur,
      skemaBayar: 'hutang',
      divisi: 'FNB',
      cabang: order.franchise,
      keterangan: `Terima order ${order.noOrder}`,
      createdBy: u.username,
    });
  }
  const [baru] = await tx
    .update(orderFranchise)
    .set({ status: 'diterima', diterimaBy: u.username, diterimaAt: tanggal })
    .where(eq(orderFranchise.id, id))
    .returning();
  await tx.insert(logs).values({
    user: u.username,
    aksi: 'TERIMA_ORDER_FRANCHISE',
    detail: `Order ${order.noOrder} diterima di ${order.franchise}: ${items.length} produk masuk stok outlet`,
  });
  return baru;
}

/**
 * Tolak / batalkan. Saat diajukan: franchise membatalkan, Pusat menolak (alasan wajib).
 * Saat dikirim (belum diterima): hanya Pusat, faktur dibatalkan (stok Pusat kembali, kas dibalik).
 */
export async function batalOrder(tx: Tx, id: string, u: Pelaku, alasan: string) {
  const { order } = await kunciOrder(tx, id, u);
  wajibStatus(order, 'diajukan', 'dikirim');
  const pusat = isTimPusat(u);
  if (pusat && !alasan.trim()) throw new BusinessError('Alasan wajib diisi');

  if (order.status === 'dikirim') {
    wajibPusat(u);
    if (order.noFaktur) {
      const [f] = await tx.select({ id: fakturPenjualan.id }).from(fakturPenjualan).where(eq(fakturPenjualan.noFaktur, order.noFaktur)).limit(1);
      if (f) await batalkanFakturPenjualan(tx, order.noFaktur, u.username, u.username);
    }
  }
  const status: StatusOrder = pusat && order.status === 'diajukan' ? 'ditolak' : 'dibatalkan';
  const [baru] = await tx
    .update(orderFranchise)
    .set({ status, alasan: alasan.trim() || null })
    .where(eq(orderFranchise.id, id))
    .returning();
  await tx.insert(logs).values({
    user: u.username,
    aksi: status === 'ditolak' ? 'TOLAK_ORDER_FRANCHISE' : 'BATAL_ORDER_FRANCHISE',
    detail: `Order ${order.noOrder} (${order.franchise}) ${status}${order.status === 'dikirim' ? `, faktur ${order.noFaktur} dibatalkan` : ''}${alasan.trim() ? `: ${alasan.trim()}` : ''}`,
  });
  return baru;
}

export async function daftarOrder(u: Pelaku, ex: Executor = db) {
  const lingkup = franchiseTerlihat(u);
  const rows = await ex
    .select()
    .from(orderFranchise)
    .where(lingkup ? eq(orderFranchise.franchise, lingkup) : undefined)
    .orderBy(desc(orderFranchise.tanggal))
    .limit(200);
  const ids = rows.map((r) => r.id);
  const items = ids.length ? await ex.select().from(orderFranchiseItems).where(inArray(orderFranchiseItems.orderId, ids)) : [];
  const noFaktur = rows.map((r) => r.noFaktur).filter(Boolean) as string[];
  const faktur = noFaktur.length
    ? await ex
        .select({ noFaktur: fakturPenjualan.noFaktur, sisaPiutang: fakturPenjualan.sisaPiutang, status: fakturPenjualan.status, jatuhTempo: fakturPenjualan.jatuhTempo })
        .from(fakturPenjualan)
        .where(inArray(fakturPenjualan.noFaktur, noFaktur))
    : [];
  return rows.map((r) => ({
    ...r,
    items: items.filter((i) => i.orderId === r.id),
    tagihan: faktur.find((f) => f.noFaktur === r.noFaktur) ?? null,
  }));
}
