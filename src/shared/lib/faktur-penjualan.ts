import { eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { barangKeluar, fakturPenjualan, inventory, keuangan, logs } from '@/shared/lib/db/schema';
import { BusinessError, decrementStock, incrementStock } from '@/shared/lib/stock';
import { hitungFaktur, LABEL_METODE, type MetodeBayar } from '@/shared/lib/faktur-hitung';
import { fakturPunyaRetur } from '@/shared/lib/retur-pelanggan';
import { AKUN, balikJurnal, penerimaKas, posting } from '@/shared/lib/jurnal';

const rp = (n: number) => Math.round(n * 100) / 100;

// ============================================================
// Faktur Penjualan (grosir). Wajib dipanggil di dalam db.transaction.
// Header di faktur_penjualan; baris barang di barang_keluar (trx_id = no_faktur).
// Pembayaran (tunai / transfer / DP) = kas masuk; sisa = piutang di header.
// ============================================================

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface BarisInput {
  sku: string; // sudah dinormalisasi
  qty: number; // dalam satuan yang dipilih
  hargaJual: number; // per satuan yang dipilih
  diskon: number;
  satuan: 'pcs' | 'karton';
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
  /** Akun pendapatan; bawaan Penjualan Faktur (Grosir). Order franchise memakai Penjualan Franchise. */
  akunPendapatan?: string;
  /** Username pembuat faktur: tunai yang diterima akun sales dicatat di Kas di Tangan Sales. */
  username?: string | null;
}

export async function buatFakturPenjualan(tx: Tx, f: FakturPenjualanInput) {
  const h = hitungFaktur(f.baris, f);
  // Tempo tanpa jatuh tempo: 30 hari dari tanggal faktur
  const jatuhTempo =
    h.sisaPiutang > 0 ? f.jatuhTempo ?? new Date(f.tanggal.getTime() + 30 * 24 * 60 * 60 * 1000) : null;

  const rows: (typeof barangKeluar.$inferSelect)[] = [];
  let totalHpp = 0;
  for (let i = 0; i < f.baris.length; i++) {
    const b = f.baris[i];
    // Beli kartonan: isi per karton diambil dari master barang, bukan dari klien.
    let isi = 1;
    const [p] = await tx
      .select({ settingPcs: inventory.settingPcs, pakaiKarton: inventory.pakaiKarton, hargaBeli: inventory.hargaBeli })
      .from(inventory)
      .where(eq(inventory.sku, b.sku));
    if (b.satuan === 'karton') {
      if (!p?.pakaiKarton || p.settingPcs <= 1) throw new BusinessError(`Barang ${b.sku} tidak dijual per karton`);
      isi = p.settingPcs;
    }
    // Stok & baris barang_keluar selalu dalam pcs (laporan dan pembatalan bergantung pada ini).
    const qtyPcs = b.qty * isi;
    // HPP aktual = harga beli rata-rata saat ini x qty pcs
    const hpp = rp(qtyPcs * (Number(p?.hargaBeli ?? 0) || 0));
    totalHpp = rp(totalHpp + hpp);
    // Kurangi stok hanya bila masih cukup (aman dari transaksi bersamaan)
    const inv = await decrementStock(tx, b.sku, qtyPcs, f.cabang);
    const [row] = await tx
      .insert(barangKeluar)
      .values({
        trxId: f.noFaktur,
        tanggal: f.tanggal,
        sku: b.sku,
        namaBarang: inv.namaBarang,
        qty: qtyPcs,
        satuan: 'pcs',
        hargaJual: String(Math.round((b.hargaJual / isi) * 100) / 100),
        total: String(h.totalBaris[i]),
        hpp: String(hpp),
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
      referensi: f.noFaktur,
      createdBy: f.user,
    });
  }

  // Jurnal: kas (uang muka/lunas) + piutang + potongan = penjualan + PPN + ongkir; HPP keluar dari persediaan
  const terima = await penerimaKas(tx, f.username, f.metodeBayar);
  await posting(tx, {
    tanggal: f.tanggal,
    divisi: f.divisi,
    cabang: f.cabang,
    sumber: 'FAKTUR',
    referensi: f.noFaktur,
    keterangan: `Faktur ${f.noFaktur} ke ${f.pelanggan} (${LABEL_METODE[f.metodeBayar]})`,
    user: f.user,
    baris: [
      { akun: terima.akun, debit: h.dibayar, sales: terima.sales },
      { akun: AKUN.PIUTANG, debit: h.sisaPiutang },
      { akun: AKUN.POTONGAN_PENJUALAN, debit: h.diskonFaktur },
      { akun: f.akunPendapatan ?? AKUN.PENJUALAN_FAKTUR, kredit: h.subtotal },
      { akun: AKUN.PPN_KELUARAN, kredit: h.ppn },
      { akun: AKUN.PENDAPATAN_ONGKIR, kredit: h.ongkir },
      { akun: AKUN.HPP, debit: totalHpp },
      { akun: AKUN.PERSEDIAAN, kredit: totalHpp },
    ],
  });

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
  // Stok & uang yang sudah diretur akan terhitung dua kali bila faktur dibatalkan utuh
  if (await fakturPunyaRetur(tx, noFaktur)) {
    throw new BusinessError(`Faktur ${noFaktur} punya retur pelanggan. Batalkan returnya dulu di menu Retur Barang.`);
  }
  // Hapus header dulu & ambil barisnya: dua pembatalan bersamaan, hanya satu yang jalan
  const [faktur] = await tx.delete(fakturPenjualan).where(eq(fakturPenjualan.noFaktur, noFaktur)).returning();
  if (!faktur) return null;

  const rows = await tx.delete(barangKeluar).where(eq(barangKeluar.trxId, noFaktur)).returning();
  for (const r of rows) await incrementStock(tx, r.sku, r.qty, r.cabang);

  // dibayar di header sudah termasuk semua cicilan, jadi seluruh kas faktur ikut dibalik
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
      referensi: noFaktur,
      createdBy: username,
    });
  }

  // Balik jurnal faktur & semua pembayaran piutangnya (kas yang dibalik = dibayar di header)
  await balikJurnal(tx, {
    referensi: noFaktur,
    sumber: ['FAKTUR', 'BAYAR_PIUTANG'],
    keterangan: `Pembatalan faktur ${noFaktur} (${faktur.pelanggan})`,
    user: username ?? user,
  });

  await tx.insert(logs).values({
    user,
    aksi: 'BATAL_FAKTUR_PENJUALAN',
    detail: `Membatalkan faktur ${noFaktur} (${faktur.pelanggan}): ${rows.length} barang dikembalikan ke stok, Rp ${dibayar.toLocaleString('id-ID')} dibalik dari kas`,
  });

  return { faktur, rows };
}
