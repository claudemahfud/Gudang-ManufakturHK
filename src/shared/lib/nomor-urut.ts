import { sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

/** Tanggal kalender WIB (Asia/Jakarta) sebagai { iso: 'YYYY-MM-DD', yy, bb, tt }. */
function tanggalWib(waktu: Date) {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(waktu);
  const [yyyy, bb, tt] = iso.split('-');
  return { iso, yy: yyyy.slice(2), bb, tt };
}

/**
 * Kode awalan per jenis dokumen; tiap kode punya seri sendiri.
 * POS = penjualan kasir, FKTR = faktur penjualan, SJ = surat jalan, PO = purchase order,
 * PRD = produksi dapur, ORF = order franchise, MTS = mutasi barang, RTRN = retur, JRN = jurnal akuntansi, STR = setoran sales,
 * BOP = biaya operasional.
 */
export type SeriNomor = 'POS' | 'FKTR' | 'SJ' | 'PO' | 'BM' | 'PRD' | 'ORF' | 'MTS' | 'RTRN' | 'JRN' | 'STR' | 'BOP';

/**
 * Nomor dokumen berurutan KODE + YYBBTTNNN (tahun 2 digit, bulan, tanggal, seri 3 digit),
 * mis. POS261124001. Tahun mencegah bentrok dengan nomor tanggal yang sama tahun sebelumnya.
 * Seri kembali ke 001 setiap hari (WIB). Atomik lewat upsert, aman untuk kasir bersamaan.
 * Panggil di dalam transaksi bila memungkinkan agar nomor tidak terpakai saat transaksi gagal.
 */
export async function nomorUrut(ex: Executor, prefix: SeriNomor, waktu = new Date()): Promise<string> {
  const { iso, yy, bb, tt } = tanggalWib(waktu);
  const rows = await ex.execute(sql`
    INSERT INTO nomor_urut (prefix, tanggal, terakhir)
    VALUES (${prefix}, ${iso}::date, 1)
    ON CONFLICT (prefix, tanggal) DO UPDATE SET terakhir = nomor_urut.terakhir + 1
    RETURNING terakhir
  `);
  const n = Number((rows as unknown as { terakhir: number }[])[0]?.terakhir);
  if (!Number.isFinite(n) || n < 1) throw new Error('Gagal mengambil nomor urut');
  return `${prefix}${yy}${bb}${tt}${String(n).padStart(3, '0')}`;
}
