import { sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { logs } from '@/shared/lib/db/schema';
import { BusinessError } from '@/shared/lib/stock';
import { AKUN, entitasDari, posting } from '@/shared/lib/jurnal';

// ============================================================
// Verifikasi Transfer: penerimaan Bank / QRIS yang dicatat akun sales dicocokkan Finance dengan
// mutasi rekening. Menutup celah "tunai diterima tetapi dicatat sebagai transfer".
// Tidak ditemukan -> Dr Kas di Tangan Sales, Cr Bank/QRIS: sales wajib menyetornya.
// ============================================================

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

const rp = (n: number) => Math.round(n * 100) / 100;

export interface TransferSales {
  referensi: string;
  akun: string;
  akunNama: string;
  sales: string;
  namaSales: string;
  tanggal: string;
  jumlah: number;
  umurHari: number;
  status: 'belum' | 'cocok' | 'dipindahkan';
  catatan: string | null;
  diverifikasiOleh: string | null;
}

export async function daftarTransferSales(
  ex: Executor,
  divisi: string,
  opsi: { status?: 'belum' | 'semua'; referensi?: string; akun?: string; sales?: string } = {}
): Promise<TransferSales[]> {
  const entitas = entitasDari(divisi);
  const rows = (await ex.execute(sql`
    SELECT x.referensi, x.akun_kode, a.nama AS akun_nama, x.sales, COALESCE(u.nama_lengkap, x.sales) AS nama_sales,
           x.tanggal, x.net::float8 AS net, v.status, v.catatan, v.diverifikasi_oleh, v.jumlah::float8 AS jumlah_v,
           GREATEST(0, EXTRACT(EPOCH FROM (now() AT TIME ZONE 'UTC' - x.tanggal)) / 86400)::int AS umur
    FROM (
      SELECT j.referensi, b.akun_kode, b.sales, MIN(j.tanggal) AS tanggal, SUM(b.debit - b.kredit) AS net
      FROM jurnal_baris b JOIN jurnal j ON j.id = b.jurnal_id
      WHERE b.akun_kode IN (${AKUN.BANK}, ${AKUN.KAS_QRIS}) AND b.sales IS NOT NULL AND j.referensi IS NOT NULL AND j.entitas = ${entitas}
        ${opsi.referensi ? sql`AND j.referensi = ${opsi.referensi}` : sql``}
        ${opsi.akun ? sql`AND b.akun_kode = ${opsi.akun}` : sql``}
        ${opsi.sales ? sql`AND b.sales = ${opsi.sales}` : sql``}
      GROUP BY j.referensi, b.akun_kode, b.sales
    ) x
    JOIN akun a ON a.kode = x.akun_kode
    LEFT JOIN users u ON u.username = x.sales
    LEFT JOIN verifikasi_transfer v ON v.referensi = x.referensi AND v.akun_kode = x.akun_kode AND v.sales = x.sales AND v.divisi = ${entitas}
    WHERE ${opsi.status === 'semua' ? sql`(v.id IS NOT NULL OR x.net > 0.009)` : sql`v.id IS NULL AND x.net > 0.009`}
    ORDER BY x.tanggal DESC
    LIMIT 300
  `)) as unknown as {
    referensi: string; akun_kode: string; akun_nama: string; sales: string; nama_sales: string; tanggal: string | Date;
    net: number; status: 'cocok' | 'dipindahkan' | null; catatan: string | null; diverifikasi_oleh: string | null; jumlah_v: number | null; umur: number;
  }[];
  return rows.map((r) => ({
    referensi: r.referensi,
    akun: r.akun_kode,
    akunNama: r.akun_nama,
    sales: r.sales,
    namaSales: r.nama_sales,
    // kolom timestamp tanpa zona menyimpan UTC
    tanggal: r.tanggal instanceof Date ? r.tanggal.toISOString() : new Date(String(r.tanggal).replace(' ', 'T') + 'Z').toISOString(),
    jumlah: rp(Number(r.status ? r.jumlah_v : r.net) || 0),
    umurHari: Number(r.umur) || 0,
    status: r.status ?? 'belum',
    catatan: r.catatan,
    diverifikasiOleh: r.diverifikasi_oleh,
  }));
}

export interface VerifikasiInput {
  referensi: string;
  akun: string;
  sales: string;
  divisi: string;
  hasil: 'cocok' | 'tidak_ditemukan';
  catatan: string | null;
}

export async function verifikasiTransfer(tx: Tx, p: VerifikasiInput, user: { username: string; nama: string }) {
  if (p.sales === user.username) throw new BusinessError('Anda tidak boleh memverifikasi transfer yang Anda catat sendiri', 403);
  if (p.hasil !== 'cocok' && !p.catatan?.trim()) throw new BusinessError('Catatan wajib diisi bila transfer tidak ditemukan');
  const entitas = entitasDari(p.divisi);
  // Satu transfer diproses berurutan
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`verif:${entitas}:${p.referensi}:${p.akun}:${p.sales}`}))`);
  const [t] = await daftarTransferSales(tx, entitas, { status: 'belum', referensi: p.referensi, akun: p.akun, sales: p.sales });
  if (!t) throw new BusinessError('Transfer tidak ditemukan di daftar belum dicek (sudah diverifikasi atau dibatalkan)', 409);

  let jurnalId: string | null = null;
  if (p.hasil === 'tidak_ditemukan') {
    jurnalId = await posting(tx, {
      tanggal: new Date(),
      divisi: entitas,
      cabang: 'Pusat',
      sumber: 'VERIFIKASI',
      referensi: t.referensi,
      keterangan: `Transfer ${t.referensi} oleh ${t.namaSales} tidak ada di mutasi: ${p.catatan}`,
      user: user.nama,
      manual: true,
      baris: [
        { akun: AKUN.KAS_SALES, debit: t.jumlah, sales: t.sales },
        { akun: t.akun, kredit: t.jumlah, sales: t.sales },
      ],
    });
  }
  const status = p.hasil === 'cocok' ? 'cocok' : 'dipindahkan';
  await tx.execute(sql`
    INSERT INTO verifikasi_transfer (referensi, akun_kode, sales, divisi, jumlah, status, catatan, diverifikasi_oleh, jurnal_id)
    VALUES (${t.referensi}, ${t.akun}, ${t.sales}, ${entitas}, ${String(t.jumlah)}, ${status}, ${p.catatan?.trim().slice(0, 500) || null}, ${user.username}, ${jurnalId})
  `);
  await tx.insert(logs).values({
    user: user.nama,
    aksi: status === 'cocok' ? 'VERIFIKASI_TRANSFER' : 'TRANSFER_TIDAK_DITEMUKAN',
    detail: `${t.referensi} (${t.akunNama}) Rp ${t.jumlah.toLocaleString('id-ID')} oleh ${t.namaSales}: ${status}${p.catatan ? ` - ${p.catatan}` : ''}`,
  });
  return { referensi: t.referensi, status, jumlah: t.jumlah };
}
