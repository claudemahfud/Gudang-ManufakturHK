import { eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { barangKeluar, fakturPenjualan, keuangan, logs } from '@/shared/lib/db/schema';
import { decrementStock, incrementStock } from '@/shared/lib/stock';
import { hitungFaktur, LABEL_METODE, type MetodeBayar } from '@/shared/lib/faktur-hitung';

// ============================================================
// Faktur Penjualan (grosir). Wajib dipanggil di dalam db.transaction.
// Header di faktur_penjualan; baris barang di barang_keluar (trx_id = no_faktur).
// Pembayaran (tunai / transfer / DP) = kas masuk; sisa = piutang di header.
// ============================================================

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface BarisInput {
  sku: string; // sudah dinormalisasi
  qty: number;
  hargaJual: number;
  diskon: number;
  satuan: string;
}

export interface FakturPenjualanInput {
  noFaktur: string;
  tanggal: Date;
  jatuhTempo: Date | null;
  pelanggan: string;
  pelangganId: string | null;
  telepon: string | null;
  alamat: string | null;
  salesman: string | null;
  baris: BarisInput[];
  diskonFaktur: number;
  ppnPersen: number;
  ongkir: number;
  metodeBayar: MetodeBayar;
  dibayar?: number;
  divisi: string;
  cabang: string;
  catatan: string | null;
  user: string;
}

export async function buatFakturPenjualan(tx: Tx, f: FakturPenjualanInput) {
  const h = hitungFaktur(f.baris, f);
  // Tempo tanpa jatuh tempo: 30 hari dari tanggal faktur
  const jatuhTempo =
    h.sisaPiutang > 0 ? f.jatuhTempo ?? new Date(f.tanggal.getTime() + 30 * 24 * 60 * 60 * 1000) : null;

  const rows: (typeof barangKeluar.$inferSelect)[] = [];
  for (let i = 0; i < f.baris.length; i++) {
    const b = f.baris[i];
    // Kurangi stok hanya bila masih cukup (aman dari transaksi bersamaan)
    const inv = await decrementStock(tx, b.sku, b.qty, f.cabang);
    const [row] = await tx
      .insert(barangKeluar)
      .values({
        trxId: f.noFaktur,
        tanggal: f.tanggal,
        sku: b.sku,
        namaBarang: inv.namaBarang,
        qty: b.qty,
        satuan: b.satuan,
        hargaJual: String(b.hargaJual),
        total: String(h.totalBaris[i]),
        pelanggan: f.pelanggan,
        salesman: f.salesman,
        diskon: String(b.diskon),
        divisi: f.divisi,
        cabang: f.cabang,
        channel: 'GROSIR',
        keterangan: f.catatan,
        createdBy: f.user,
      })
      .returning();
    rows.push(row);
  }

  const [faktur] = await tx
    .insert(fakturPenjualan)
    .values({
      noFaktur: f.noFaktur,
      tanggal: f.tanggal,
      jatuhTempo,
      pelanggan: f.pelanggan,
      pelangganId: f.pelangganId,
      telepon: f.telepon,
      alamat: f.alamat,
      salesman: f.salesman,
      subtotal: String(h.subtotal),
      diskonFaktur: String(h.diskonFaktur),
      ppnPersen: String(Math.min(100, Math.max(0, f.ppnPersen || 0))),
      ppn: String(h.ppn),
      ongkir: String(h.ongkir),
      grandTotal: String(h.grandTotal),
      metodeBayar: f.metodeBayar,
      dibayar: String(h.dibayar),
      sisaPiutang: String(h.sisaPiutang),
      status: h.status,
      divisi: f.divisi,
      cabang: f.cabang,
      catatan: f.catatan,
      createdBy: f.user,
    })
    .returning();

  if (h.dibayar > 0) {
    await tx.insert(keuangan).values({
      tanggal: f.tanggal,
      jenis: 'masuk',
      kategori: 'Penjualan Grosir',
      jumlah: String(h.dibayar),
      divisi: f.divisi,
      cabang: f.cabang,
      keterangan: `${h.status === 'lunas' ? 'Pelunasan' : 'Uang muka'} faktur ${f.noFaktur} (${LABEL_METODE[f.metodeBayar]}) dari ${f.pelanggan}`,
      createdBy: f.user,
    });
  }

  await tx.insert(logs).values({
    user: f.user,
    aksi: 'FAKTUR_PENJUALAN',
    detail: `Faktur ${f.noFaktur} ke ${f.pelanggan}: ${f.baris.length} barang, total Rp ${h.grandTotal.toLocaleString('id-ID')}, dibayar Rp ${h.dibayar.toLocaleString('id-ID')} (${LABEL_METODE[f.metodeBayar]}), sisa piutang Rp ${h.sisaPiutang.toLocaleString('id-ID')}`,
  });

  return { faktur, rows, hitung: h };
}

/**
 * Batalkan seluruh faktur: semua barisnya dihapus, stok dikembalikan,
 * kas yang sudah diterima dibalik. Return null bila trxId bukan faktur penjualan.
 */
export async function batalkanFakturPenjualan(tx: Tx, noFaktur: string, user: string, username: string | null) {
  // Hapus header dulu & ambil barisnya: dua pembatalan bersamaan, hanya satu yang jalan
  const [faktur] = await tx.delete(fakturPenjualan).where(eq(fakturPenjualan.noFaktur, noFaktur)).returning();
  if (!faktur) return null;

  const rows = await tx.delete(barangKeluar).where(eq(barangKeluar.trxId, noFaktur)).returning();
  for (const r of rows) await incrementStock(tx, r.sku, r.qty, r.cabang);

  const dibayar = Number(faktur.dibayar) || 0;
  if (dibayar > 0) {
    await tx.insert(keuangan).values({
      tanggal: new Date(),
      jenis: 'keluar',
      kategori: 'Pembatalan Penjualan Grosir',
      jumlah: String(dibayar),
      divisi: faktur.divisi,
      cabang: faktur.cabang,
      keterangan: `Pembatalan faktur ${noFaktur} (${faktur.pelanggan}): pengembalian pembayaran`,
      createdBy: username,
    });
  }

  await tx.insert(logs).values({
    user,
    aksi: 'BATAL_FAKTUR_PENJUALAN',
    detail: `Membatalkan faktur ${noFaktur} (${faktur.pelanggan}): ${rows.length} barang dikembalikan ke stok, Rp ${dibayar.toLocaleString('id-ID')} dibalik dari kas`,
  });

  return { faktur, rows };
}
