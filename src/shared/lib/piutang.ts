import { eq, sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { fakturPenjualan, keuangan, logs, piutangMutasi } from '@/shared/lib/db/schema';
import { BusinessError } from '@/shared/lib/stock';
import { AKUN, akunKas, posting } from '@/shared/lib/jurnal';

// ============================================================
// Piutang pelanggan dari Faktur Penjualan.
// - bayarPiutang: lunas penuh atau cicilan (+ opsional mundurkan jatuh tempo sisa)
// - mundurkanJatuhTempo: tagihan ditunda tanpa pembayaran
// - auditPiutang: cocokkan header faktur, riwayat mutasi, dan kas
// Fungsi tulis wajib dipanggil di dalam db.transaction.
// ============================================================

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

export type MetodeTerima = 'tunai' | 'transfer';
export const LABEL_METODE_TERIMA: Record<MetodeTerima, string> = { tunai: 'Tunai', transfer: 'Transfer' };

const rp = (n: number) => Math.round(n * 100) / 100;
const HARI = 24 * 60 * 60 * 1000;
const awalHari = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const tgl = (d: Date | null) => (d ? d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

async function kunciFaktur(tx: Tx, noFaktur: string) {
  // FOR UPDATE: dua pembayaran bersamaan untuk faktur yang sama antre, sisa tidak bisa minus
  const [f] = await tx.select().from(fakturPenjualan).where(eq(fakturPenjualan.noFaktur, noFaktur)).for('update').limit(1);
  if (!f) throw new BusinessError('Faktur tidak ditemukan (mungkin sudah dibatalkan)', 404);
  return f;
}

export interface BayarInput {
  jumlah: number;
  metode: MetodeTerima;
  tanggal: Date;
  /** Jatuh tempo baru untuk sisa (hanya bila belum lunas setelah pembayaran ini). */
  jatuhTempoBaru: Date | null;
  catatan: string | null;
}

export async function bayarPiutang(tx: Tx, noFaktur: string, p: BayarInput, user: string) {
  const f = await kunciFaktur(tx, noFaktur);
  const sisa = rp(Number(f.sisaPiutang));
  const jumlah = rp(p.jumlah);
  if (sisa <= 0) throw new BusinessError(`Faktur ${noFaktur} sudah lunas`);
  if (!(jumlah > 0)) throw new BusinessError('Jumlah pembayaran harus lebih dari 0');
  if (jumlah > sisa) {
    throw new BusinessError(`Pembayaran Rp ${jumlah.toLocaleString('id-ID')} melebihi sisa piutang Rp ${sisa.toLocaleString('id-ID')}`);
  }
  if (awalHari(p.tanggal) < awalHari(f.tanggal)) throw new BusinessError('Tanggal bayar tidak boleh sebelum tanggal faktur');

  const dibayar = rp(Number(f.dibayar) + jumlah);
  const sisaBaru = rp(sisa - jumlah);
  const lunas = sisaBaru <= 0;

  let jatuhTempo = f.jatuhTempo;
  if (!lunas && p.jatuhTempoBaru) {
    if (awalHari(p.jatuhTempoBaru) < awalHari(p.tanggal)) {
      throw new BusinessError('Jatuh tempo baru tidak boleh sebelum tanggal pembayaran');
    }
    jatuhTempo = p.jatuhTempoBaru;
  }
  const tempoBerubah = !lunas && !!p.jatuhTempoBaru && jatuhTempo?.getTime() !== f.jatuhTempo?.getTime();

  const [faktur] = await tx
    .update(fakturPenjualan)
    .set({
      dibayar: String(dibayar),
      sisaPiutang: String(sisaBaru),
      status: lunas ? 'lunas' : 'sebagian',
      jatuhTempo,
    })
    .where(eq(fakturPenjualan.noFaktur, noFaktur))
    .returning();

  const [mutasi] = await tx
    .insert(piutangMutasi)
    .values({
      noFaktur,
      jenis: 'bayar',
      tanggal: p.tanggal,
      jumlah: String(jumlah),
      metode: p.metode,
      jatuhTempoLama: tempoBerubah ? f.jatuhTempo : null,
      jatuhTempoBaru: tempoBerubah ? jatuhTempo : null,
      sisaSetelah: String(sisaBaru),
      catatan: p.catatan,
      createdBy: user,
    })
    .returning();

  await tx.insert(keuangan).values({
    tanggal: p.tanggal,
    jenis: 'masuk',
    kategori: lunas ? 'Pelunasan Piutang' : 'Cicilan Piutang',
    jumlah: String(jumlah),
    divisi: f.divisi,
    cabang: f.cabang,
    keterangan: `${lunas ? 'Pelunasan' : 'Cicilan'} faktur ${noFaktur} (${LABEL_METODE_TERIMA[p.metode]}) dari ${f.pelanggan}${lunas ? '' : `, sisa Rp ${sisaBaru.toLocaleString('id-ID')}`}`,
    referensi: noFaktur,
    createdBy: user,
  });

  await posting(tx, {
    tanggal: p.tanggal,
    divisi: f.divisi,
    cabang: f.cabang,
    sumber: 'BAYAR_PIUTANG',
    referensi: noFaktur,
    keterangan: `${lunas ? 'Pelunasan' : 'Cicilan'} piutang faktur ${noFaktur} dari ${f.pelanggan} (${LABEL_METODE_TERIMA[p.metode]})`,
    user,
    baris: [
      { akun: akunKas(p.metode), debit: jumlah },
      { akun: AKUN.PIUTANG, kredit: jumlah },
    ],
  });

  await tx.insert(logs).values({
    user,
    aksi: lunas ? 'PELUNASAN_PIUTANG' : 'CICILAN_PIUTANG',
    detail: `Faktur ${noFaktur} (${f.pelanggan}): terima Rp ${jumlah.toLocaleString('id-ID')} ${LABEL_METODE_TERIMA[p.metode]}, sisa Rp ${sisaBaru.toLocaleString('id-ID')}${tempoBerubah ? `, jatuh tempo ${tgl(f.jatuhTempo)} -> ${tgl(jatuhTempo)}` : ''}`,
  });

  return { faktur, mutasi };
}

export async function mundurkanJatuhTempo(tx: Tx, noFaktur: string, baru: Date, alasan: string, user: string) {
  const f = await kunciFaktur(tx, noFaktur);
  if (Number(f.sisaPiutang) <= 0) throw new BusinessError(`Faktur ${noFaktur} sudah lunas`);
  if (!alasan.trim()) throw new BusinessError('Alasan penundaan wajib diisi');
  // Mundur = lebih lambat dari jatuh tempo sekarang (atau dari hari ini bila belum ada)
  const acuan = f.jatuhTempo ?? new Date();
  if (awalHari(baru) <= awalHari(acuan)) {
    throw new BusinessError(`Jatuh tempo baru harus setelah ${tgl(acuan)}`);
  }

  const [faktur] = await tx
    .update(fakturPenjualan)
    .set({ jatuhTempo: baru })
    .where(eq(fakturPenjualan.noFaktur, noFaktur))
    .returning();

  const [mutasi] = await tx
    .insert(piutangMutasi)
    .values({
      noFaktur,
      jenis: 'ubah_tempo',
      jumlah: '0',
      jatuhTempoLama: f.jatuhTempo,
      jatuhTempoBaru: baru,
      sisaSetelah: f.sisaPiutang,
      catatan: alasan.trim(),
      createdBy: user,
    })
    .returning();

  await tx.insert(logs).values({
    user,
    aksi: 'MUNDUR_JATUH_TEMPO',
    detail: `Faktur ${noFaktur} (${f.pelanggan}): jatuh tempo ${tgl(f.jatuhTempo)} -> ${tgl(baru)}. Alasan: ${alasan.trim()}`,
  });

  return { faktur, mutasi };
}

/** Hari lewat jatuh tempo (negatif = belum jatuh tempo). null bila tanpa jatuh tempo. */
export function hariTerlambat(jatuhTempo: Date | null, sekarang = new Date()) {
  return jatuhTempo ? Math.round((awalHari(sekarang) - awalHari(jatuhTempo)) / HARI) : null;
}

export interface TemuanAudit {
  noFaktur: string;
  pelanggan: string | null;
  masalah: string;
}

/**
 * Audit arus kas piutang. Untuk setiap faktur:
 * 1. grand total = dibayar + sisa piutang + nilai retur (potong piutang & refund)
 * 2. status sesuai sisa (lunas / sebagian / belum lunas)
 * 3. dibayar = kas bersih yang tercatat dengan referensi faktur ini
 * 4. jumlah cicilan − refund retur <= dibayar (selisihnya = uang muka saat faktur dibuat)
 * Ditambah kas berreferensi faktur yang fakturnya sudah tidak ada tetapi belum nol.
 */
export async function auditPiutang(ex: Executor = db) {
  const rows = (await ex.execute(sql`
    SELECT f.no_faktur, f.pelanggan, f.grand_total::float8 AS grand, f.dibayar::float8 AS dibayar,
           f.sisa_piutang::float8 AS sisa, f.status,
           COALESCE(k.net, 0)::float8 AS kas_net, COALESCE(m.cicilan, 0)::float8 AS cicilan,
           COALESCE(m.retur, 0)::float8 AS retur, COALESCE(m.refund, 0)::float8 AS refund
    FROM faktur_penjualan f
    LEFT JOIN (
      SELECT referensi, SUM(CASE WHEN jenis = 'masuk' THEN jumlah ELSE -jumlah END) AS net
      FROM keuangan WHERE referensi IS NOT NULL GROUP BY referensi
    ) k ON k.referensi = f.no_faktur
    LEFT JOIN (
      SELECT no_faktur,
             SUM(CASE WHEN jenis = 'bayar' THEN jumlah ELSE 0 END) AS cicilan,
             SUM(CASE jenis WHEN 'retur' THEN jumlah WHEN 'batal_retur' THEN -jumlah ELSE 0 END) AS retur,
             SUM(CASE jenis WHEN 'refund' THEN jumlah WHEN 'batal_refund' THEN -jumlah ELSE 0 END) AS refund
      FROM piutang_mutasi WHERE jenis <> 'ubah_tempo' GROUP BY no_faktur
    ) m ON m.no_faktur = f.no_faktur
  `)) as unknown as {
    no_faktur: string; pelanggan: string; grand: number; dibayar: number; sisa: number;
    status: string; kas_net: number; cicilan: number; retur: number; refund: number;
  }[];

  const yatim = (await ex.execute(sql`
    SELECT k.referensi, SUM(CASE WHEN k.jenis = 'masuk' THEN k.jumlah ELSE -k.jumlah END)::float8 AS net
    FROM keuangan k
    WHERE k.referensi IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM faktur_penjualan f WHERE f.no_faktur = k.referensi)
    GROUP BY k.referensi
    HAVING ABS(SUM(CASE WHEN k.jenis = 'masuk' THEN k.jumlah ELSE -k.jumlah END)) > 0.009
  `)) as unknown as { referensi: string; net: number }[];

  const beda = (a: number, b: number) => Math.abs(a - b) > 0.009;
  const f = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
  const temuan: TemuanAudit[] = [];
  let totalPiutang = 0;
  let totalKasFaktur = 0;

  for (const r of rows) {
    totalPiutang += r.sisa;
    totalKasFaktur += r.kas_net;
    const t = (masalah: string) => temuan.push({ noFaktur: r.no_faktur, pelanggan: r.pelanggan, masalah });
    // Retur pelanggan memotong sisa (retur) atau mengembalikan uang yang sudah dibayar (refund)
    const diretur = r.retur + r.refund;
    if (beda(r.grand, r.dibayar + r.sisa + diretur)) {
      t(`Grand total ${f(r.grand)} ≠ dibayar ${f(r.dibayar)} + sisa ${f(r.sisa)}${diretur ? ` + retur ${f(diretur)}` : ''}`);
    }
    const statusSeharusnya = r.sisa <= 0.009 ? 'lunas' : r.dibayar > 0.009 ? 'sebagian' : 'belum_lunas';
    if (r.status !== statusSeharusnya) t(`Status "${r.status}" seharusnya "${statusSeharusnya}"`);
    if (beda(r.dibayar, r.kas_net)) t(`Dibayar ${f(r.dibayar)} ≠ kas tercatat ${f(r.kas_net)}`);
    if (r.cicilan - r.refund - r.dibayar > 0.009) t(`Total cicilan ${f(r.cicilan)} melebihi dibayar ${f(r.dibayar)}`);
  }
  for (const y of yatim) {
    temuan.push({ noFaktur: y.referensi, pelanggan: null, masalah: `Faktur tidak ada, tetapi kas bersihnya ${f(y.net)} (seharusnya 0)` });
  }

  return {
    jumlahFaktur: rows.length,
    totalPiutang: rp(totalPiutang),
    totalKasFaktur: rp(totalKasFaktur),
    temuan,
    sehat: temuan.length === 0,
  };
}
