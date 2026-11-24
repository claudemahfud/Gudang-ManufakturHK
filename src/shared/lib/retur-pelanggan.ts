import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import {
  barangKeluar,
  barangMasuk,
  barangRusak,
  fakturPenjualan,
  inventory,
  keuangan,
  logs,
  orderFranchise,
  piutangMutasi,
  returBarang,
} from '@/shared/lib/db/schema';
import { BusinessError, decrementStock, incrementStock } from '@/shared/lib/stock';

// ============================================================
// Retur dari pelanggan (dicatat lewat Barang Masuk, jenis RETUR_PELANGGAN).
// Satu transaksi menulis ke semua fitur terkait:
// - Retur Barang & Laporan Rusak/Retur: baris retur_barang
// - Kondisi layak: barang_masuk (jenis retur, HPP tetap) + stok cabang bertambah
//   Kondisi rusak : barang_rusak (stok tidak bertambah, masuk laporan kerugian)
// - Dengan faktur: nilai retur memotong sisa piutang dulu; kelebihannya
//   (bagian yang sudah dibayar) dikembalikan sebagai uang (kas keluar berreferensi faktur).
//   Tercatat di riwayat piutang sebagai mutasi 'retur' / 'refund'.
// - Tanpa faktur: tanpa pengembalian uang, atau refund tunai/transfer (kas keluar).
// Fungsi tulis wajib dipanggil di dalam db.transaction.
// ============================================================

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

export type KondisiRetur = 'layak' | 'rusak';
export type MetodeRefund = 'tunai' | 'transfer';

const rp = (n: number) => Math.round(n * 100) / 100;
const rupiah = (n: number) => `Rp ${rp(n).toLocaleString('id-ID')}`;

export interface BarisReturFaktur {
  sku: string;
  namaBarang: string;
  qtyTerjual: number;
  qtySudahRetur: number;
  qtyBisaRetur: number;
  /** Nilai bersih per pcs: harga baris setelah diskon baris, diskon faktur & PPN (tanpa ongkir). */
  nilaiPerPcs: number;
}

/** Faktor dari nilai baris ke nilai yang ditagihkan: (grand total − ongkir) / subtotal. */
function faktorFaktur(f: { subtotal: string; grandTotal: string; ongkir: string }) {
  const subtotal = Number(f.subtotal) || 0;
  return subtotal > 0 ? (Number(f.grandTotal) - Number(f.ongkir)) / subtotal : 1;
}

/** Baris faktur yang masih bisa diretur (qty dalam pcs). */
export async function barisReturFaktur(ex: Executor, noFaktur: string) {
  const [f] = await ex.select().from(fakturPenjualan).where(eq(fakturPenjualan.noFaktur, noFaktur)).limit(1);
  if (!f) throw new BusinessError('Faktur tidak ditemukan', 404);
  const faktor = faktorFaktur(f);

  const jual = await ex
    .select({
      sku: barangKeluar.sku,
      namaBarang: sql<string>`MAX(${barangKeluar.namaBarang})`,
      qty: sql<number>`SUM(${barangKeluar.qty})::int`,
      total: sql<number>`SUM(${barangKeluar.total})::float8`,
    })
    .from(barangKeluar)
    .where(eq(barangKeluar.trxId, noFaktur))
    .groupBy(barangKeluar.sku);

  const sudah = await ex
    .select({ sku: returBarang.sku, qty: sql<number>`SUM(${returBarang.qty})::int` })
    .from(returBarang)
    .where(eq(returBarang.noFaktur, noFaktur))
    .groupBy(returBarang.sku);
  const sudahMap = new Map(sudah.map((s) => [s.sku, Number(s.qty)]));

  const baris: BarisReturFaktur[] = jual.map((j) => {
    const qtyTerjual = Number(j.qty) || 0;
    const qtySudahRetur = sudahMap.get(j.sku) ?? 0;
    return {
      sku: j.sku,
      namaBarang: j.namaBarang,
      qtyTerjual,
      qtySudahRetur,
      qtyBisaRetur: Math.max(0, qtyTerjual - qtySudahRetur),
      nilaiPerPcs: qtyTerjual > 0 ? rp(((Number(j.total) || 0) / qtyTerjual) * faktor) : 0,
    };
  });
  return { faktur: f, baris };
}

/** Faktur terbaru untuk dipilih sebagai asal retur (bukan faktur order franchise). */
export async function daftarFakturRetur(ex: Executor, cari: string | null, limit = 50) {
  const q = cari?.trim();
  const syarat = [
    sql`NOT EXISTS (SELECT 1 FROM ${orderFranchise} o WHERE o.no_faktur = ${fakturPenjualan.noFaktur})`,
    q ? sql`(${fakturPenjualan.noFaktur} ILIKE ${'%' + q + '%'} OR ${fakturPenjualan.pelanggan} ILIKE ${'%' + q + '%'})` : undefined,
  ].filter(Boolean);
  return ex
    .select({
      noFaktur: fakturPenjualan.noFaktur,
      tanggal: fakturPenjualan.tanggal,
      pelanggan: fakturPenjualan.pelanggan,
      grandTotal: fakturPenjualan.grandTotal,
      sisaPiutang: fakturPenjualan.sisaPiutang,
      cabang: fakturPenjualan.cabang,
    })
    .from(fakturPenjualan)
    .where(and(...(syarat as ReturnType<typeof sql>[])))
    .orderBy(desc(fakturPenjualan.tanggal))
    .limit(limit);
}

export interface ReturInput {
  tanggal: Date;
  sku: string;
  qty: number;
  kondisi: KondisiRetur;
  alasan: string | null;
  /** Faktur asal; null untuk retur tanpa faktur (mis. penjualan POS / umum). */
  noFaktur: string | null;
  /** Wajib bila tanpa faktur. Dengan faktur selalu diambil dari faktur. */
  pelanggan: string | null;
  /** Tanpa faktur: nilai uang yang dikembalikan (0 = tanpa pengembalian uang). */
  nilaiRefund: number;
  /** Cara uang dikembalikan (tanpa faktur dengan refund, atau faktur yang sudah dibayar). */
  metodeRefund: MetodeRefund;
  /** Cabang tujuan stok; dengan faktur bawaannya cabang faktur. */
  cabang: string;
  divisi: string;
}

export async function catatReturPelanggan(tx: Tx, p: ReturInput, user: string) {
  if (!Number.isInteger(p.qty) || p.qty <= 0) throw new BusinessError('Qty retur harus bilangan bulat lebih dari 0');
  if (p.kondisi !== 'layak' && p.kondisi !== 'rusak') throw new BusinessError('Kondisi barang retur tidak valid');

  const [inv] = await tx
    .select({ namaBarang: inventory.namaBarang, hargaBeli: inventory.hargaBeli, divisi: inventory.divisi })
    .from(inventory)
    .where(eq(inventory.sku, p.sku))
    .limit(1);
  if (!inv) throw new BusinessError(`Barang dengan SKU ${p.sku} tidak ditemukan`, 404);

  let pelanggan = p.pelanggan?.trim() || '';
  let cabang = p.cabang;
  let divisi = p.divisi || inv.divisi;
  let nilai = 0;
  let potong = 0;
  let refund = 0;
  let sisaSetelah = 0;

  if (p.noFaktur) {
    // Kunci faktur: retur & pembayaran bersamaan pada faktur yang sama antre
    const [f] = await tx.select().from(fakturPenjualan).where(eq(fakturPenjualan.noFaktur, p.noFaktur)).for('update').limit(1);
    if (!f) throw new BusinessError('Faktur asal tidak ditemukan (mungkin sudah dibatalkan)', 404);
    const [ord] = await tx.select({ id: orderFranchise.id }).from(orderFranchise).where(eq(orderFranchise.noFaktur, p.noFaktur)).limit(1);
    if (ord) throw new BusinessError('Retur dari outlet franchise belum didukung lewat Barang Masuk');

    const { baris } = await barisReturFaktur(tx, p.noFaktur);
    const b = baris.find((x) => x.sku === p.sku);
    if (!b) throw new BusinessError(`SKU ${p.sku} tidak ada di faktur ${p.noFaktur}`);
    if (p.qty > b.qtyBisaRetur) {
      throw new BusinessError(
        `Qty retur ${p.qty} melebihi sisa yang bisa diretur (${b.qtyBisaRetur} dari ${b.qtyTerjual} pcs terjual)`
      );
    }

    pelanggan = f.pelanggan;
    cabang = f.cabang;
    divisi = f.divisi;
    nilai = rp(b.nilaiPerPcs * p.qty);
    const sisa = rp(Number(f.sisaPiutang));
    const dibayar = rp(Number(f.dibayar));
    potong = rp(Math.min(nilai, sisa));
    // Pembulatan per pcs bisa membuat nilai sedikit di atas yang tersisa di faktur
    refund = rp(Math.min(nilai - potong, dibayar));
    nilai = rp(potong + refund);
    sisaSetelah = rp(sisa - potong);
    const dibayarBaru = rp(dibayar - refund);

    await tx
      .update(fakturPenjualan)
      .set({
        sisaPiutang: String(sisaSetelah),
        dibayar: String(dibayarBaru),
        status: sisaSetelah <= 0 ? 'lunas' : dibayarBaru > 0 ? 'sebagian' : 'belum_lunas',
      })
      .where(eq(fakturPenjualan.noFaktur, p.noFaktur));

    const catatan = `Retur ${p.qty} pcs ${p.sku}${p.alasan ? `: ${p.alasan}` : ''}`;
    if (potong > 0) {
      await tx.insert(piutangMutasi).values({
        noFaktur: p.noFaktur, jenis: 'retur', tanggal: p.tanggal, jumlah: String(potong),
        sisaSetelah: String(sisaSetelah), catatan, createdBy: user,
      });
    }
    if (refund > 0) {
      await tx.insert(piutangMutasi).values({
        noFaktur: p.noFaktur, jenis: 'refund', tanggal: p.tanggal, jumlah: String(refund), metode: p.metodeRefund,
        sisaSetelah: String(sisaSetelah), catatan, createdBy: user,
      });
      await tx.insert(keuangan).values({
        tanggal: p.tanggal, jenis: 'keluar', kategori: 'Refund Retur Penjualan', jumlah: String(refund),
        divisi, cabang, referensi: p.noFaktur, createdBy: user,
        keterangan: `Refund retur ${p.sku} x${p.qty} faktur ${p.noFaktur} ke ${pelanggan} (${p.metodeRefund})`,
      });
    }
  } else {
    if (!pelanggan) throw new BusinessError('Nama pelanggan wajib diisi untuk retur tanpa faktur');
    refund = rp(Number(p.nilaiRefund) || 0);
    if (refund < 0) throw new BusinessError('Nilai refund tidak boleh negatif');
    nilai = refund;
    if (refund > 0) {
      await tx.insert(keuangan).values({
        tanggal: p.tanggal, jenis: 'keluar', kategori: 'Refund Retur Penjualan', jumlah: String(refund),
        divisi, cabang, createdBy: user,
        keterangan: `Refund retur ${p.sku} x${p.qty} ke ${pelanggan} tanpa faktur (${p.metodeRefund})`,
      });
    }
  }

  const keterangan = `Retur pelanggan ${pelanggan}${p.noFaktur ? ` faktur ${p.noFaktur}` : ''}${p.alasan ? `: ${p.alasan}` : ''}`;
  let barangMasukId: string | null = null;
  let barangRusakId: string | null = null;

  if (p.kondisi === 'layak') {
    // Barang kembali dengan HPP yang sama: harga rata-rata tidak berubah, bukan hutang/kas pembelian
    const hpp = rp(Number(inv.hargaBeli) || 0);
    const [bm] = await tx
      .insert(barangMasuk)
      .values({
        tanggal: p.tanggal, sku: p.sku, namaBarang: inv.namaBarang, qty: p.qty, satuan: 'pcs',
        hargaBeli: String(hpp), totalBeli: String(rp(hpp * p.qty)), supplier: pelanggan,
        noFaktur: p.noFaktur, skemaBayar: 'retur', jenis: 'RETUR_PELANGGAN', divisi, cabang, keterangan, createdBy: user,
      })
      .returning({ id: barangMasuk.id });
    barangMasukId = bm.id;
    await incrementStock(tx, p.sku, p.qty, cabang);
  } else {
    const [br] = await tx
      .insert(barangRusak)
      .values({ tanggal: p.tanggal, sku: p.sku, namaBarang: inv.namaBarang, qty: p.qty, divisi, cabang, keterangan, createdBy: user })
      .returning({ id: barangRusak.id });
    barangRusakId = br.id;
  }

  const [retur] = await tx
    .insert(returBarang)
    .values({
      tanggal: p.tanggal, sku: p.sku, namaBarang: inv.namaBarang, qty: p.qty, alasan: p.alasan, pelanggan,
      divisi, status: 'disetujui', cabang, createdBy: user, noFaktur: p.noFaktur, kondisi: p.kondisi,
      nilai: String(nilai), potongPiutang: String(potong), refund: String(refund),
      metodeRefund: refund > 0 ? p.metodeRefund : null, barangMasukId, barangRusakId,
    })
    .returning();

  await tx.insert(logs).values({
    user,
    aksi: 'RETUR_PELANGGAN',
    detail:
      `Retur ${p.sku} x${p.qty} pcs dari ${pelanggan}${p.noFaktur ? ` (faktur ${p.noFaktur})` : ''}, ` +
      `${p.kondisi === 'layak' ? `masuk stok ${cabang}` : 'dicatat rusak'}` +
      (potong > 0 ? `, potong piutang ${rupiah(potong)}` : '') +
      (refund > 0 ? `, refund ${rupiah(refund)} (${p.metodeRefund})` : ''),
  });

  return { retur, nilai, potong, refund, sisaSetelah };
}

/** Retur ini dibuat lewat Barang Masuk (punya jejak stok/rusak yang harus dibalik bersama). */
export function returTerkelola(r: { barangMasukId: string | null; barangRusakId: string | null }) {
  return Boolean(r.barangMasukId || r.barangRusakId);
}

/** Batalkan retur pelanggan: balik stok/barang rusak, piutang, dan kas refund. */
export async function batalkanReturPelanggan(tx: Tx, returId: string, user: string) {
  const [r] = await tx.delete(returBarang).where(eq(returBarang.id, returId)).returning();
  if (!r) throw new BusinessError('Data retur tidak ditemukan', 404);
  if (!returTerkelola(r)) throw new BusinessError('Retur ini bukan retur pelanggan dari Barang Masuk');

  if (r.barangMasukId) {
    await tx.delete(barangMasuk).where(eq(barangMasuk.id, r.barangMasukId));
    try {
      await decrementStock(tx, r.sku, r.qty, r.cabang);
    } catch (e) {
      if (e instanceof BusinessError && e.status === 400) {
        throw new BusinessError(`Retur tidak bisa dibatalkan: stok ${r.sku} hasil retur sudah keluar. ${e.message}`);
      }
      throw e;
    }
  }
  if (r.barangRusakId) await tx.delete(barangRusak).where(eq(barangRusak.id, r.barangRusakId));

  const potong = rp(Number(r.potongPiutang));
  const refund = rp(Number(r.refund));
  const metode = (r.metodeRefund as MetodeRefund | null) ?? 'tunai';
  const catatan = `Batal retur ${r.qty} pcs ${r.sku}`;

  if (r.noFaktur && (potong > 0 || refund > 0)) {
    const [f] = await tx.select().from(fakturPenjualan).where(eq(fakturPenjualan.noFaktur, r.noFaktur)).for('update').limit(1);
    if (f) {
      const sisa = rp(Number(f.sisaPiutang) + potong);
      const dibayar = rp(Number(f.dibayar) + refund);
      await tx
        .update(fakturPenjualan)
        .set({ sisaPiutang: String(sisa), dibayar: String(dibayar), status: sisa <= 0 ? 'lunas' : dibayar > 0 ? 'sebagian' : 'belum_lunas' })
        .where(eq(fakturPenjualan.noFaktur, r.noFaktur));
      // Mutasi pembalik: jejak audit tetap utuh, total retur/refund bersih faktur kembali seperti sebelum retur
      if (potong > 0) {
        await tx.insert(piutangMutasi).values({
          noFaktur: r.noFaktur, jenis: 'batal_retur', jumlah: String(potong), sisaSetelah: String(sisa), catatan, createdBy: user,
        });
      }
      if (refund > 0) {
        await tx.insert(piutangMutasi).values({
          noFaktur: r.noFaktur, jenis: 'batal_refund', jumlah: String(refund), metode, sisaSetelah: String(sisa), catatan, createdBy: user,
        });
      }
    }
  }
  if (refund > 0) {
    await tx.insert(keuangan).values({
      tanggal: new Date(), jenis: 'masuk', kategori: 'Batal Refund Retur Penjualan', jumlah: String(refund),
      divisi: r.divisi, cabang: r.cabang, referensi: r.noFaktur, createdBy: user,
      keterangan: `Pembatalan refund retur ${r.sku} x${r.qty}${r.noFaktur ? ` faktur ${r.noFaktur}` : ''} (${r.pelanggan ?? '-'})`,
    });
  }

  await tx.insert(logs).values({
    user,
    aksi: 'BATAL_RETUR_PELANGGAN',
    detail:
      `Batal retur ${r.sku} x${r.qty} dari ${r.pelanggan ?? '-'}${r.noFaktur ? ` (faktur ${r.noFaktur})` : ''}` +
      (r.kondisi === 'layak' ? `, stok ${r.cabang} -${r.qty}` : ', catatan rusak dihapus') +
      (potong > 0 ? `, piutang +${rupiah(potong)}` : '') +
      (refund > 0 ? `, refund ${rupiah(refund)} dibalik` : ''),
  });
  return r;
}

/** Faktur yang punya retur tidak boleh dibatalkan utuh (stok & uang retur akan terhitung dua kali). */
export async function fakturPunyaRetur(ex: Executor, noFaktur: string) {
  const [r] = await ex.select({ id: returBarang.id }).from(returBarang).where(eq(returBarang.noFaktur, noFaktur)).limit(1);
  return Boolean(r);
}
