import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { logs, setoranSales, users } from '@/shared/lib/db/schema';
import { BusinessError } from '@/shared/lib/stock';
import { nomorUrut } from '@/shared/lib/nomor-urut';
import { AKUN, entitasDari, LABEL_SUMBER, posting } from '@/shared/lib/jurnal';

// ============================================================
// Setoran sales ke Finance.
// Tunai yang diterima sales dicatat di akun 1-1350 "Kas di Tangan Sales" (jurnal_baris.sales = username).
// Saldo per sales = debit - kredit baris 1-1350 sales itu; pembatalan transaksi (jurnal pembalik) ikut
// mengurangi saldo otomatis. Setoran: sales mengajukan -> Finance konfirmasi (Dr Kas/Bank, Cr 1-1350).
// ============================================================

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

const rp = (n: number) => Math.round(n * 100) / 100;
const TOLERANSI = 0.009;

export interface SaldoSales {
  sales: string;
  nama: string;
  saldo: number;
  menunggu: number;
  tersedia: number;
}

/** Saldo kas di tangan tiap sales (atau satu sales) untuk satu entitas. */
export async function saldoSales(ex: Executor, divisi: string, sales?: string): Promise<SaldoSales[]> {
  const entitas = entitasDari(divisi);
  const rows = (await ex.execute(sql`
    SELECT b.sales, COALESCE(SUM(b.debit - b.kredit), 0)::float8 AS saldo
    FROM jurnal_baris b JOIN jurnal j ON j.id = b.jurnal_id
    WHERE b.akun_kode = ${AKUN.KAS_SALES} AND b.sales IS NOT NULL AND j.entitas = ${entitas}
      ${sales ? sql`AND b.sales = ${sales}` : sql``}
    GROUP BY b.sales
  `)) as unknown as { sales: string; saldo: number }[];
  const menunggu = (await ex.execute(sql`
    SELECT sales, COALESCE(SUM(jumlah), 0)::float8 AS jumlah
    FROM setoran_sales WHERE status = 'menunggu' AND divisi = ${entitas}
      ${sales ? sql`AND sales = ${sales}` : sql``}
    GROUP BY sales
  `)) as unknown as { sales: string; jumlah: number }[];
  // Sales yang hanya punya setoran menunggu (saldo 0) tetap ditampilkan
  const semua = new Set([...rows.map((r) => r.sales), ...menunggu.map((m) => m.sales)]);
  if (sales) semua.add(sales);
  const nama = semua.size
    ? await ex.select({ username: users.username, namaLengkap: users.namaLengkap }).from(users)
    : [];
  const namaDari = (u: string) => nama.find((n) => n.username === u)?.namaLengkap ?? u;
  return [...semua]
    .map((u) => {
      const saldo = rp(Number(rows.find((r) => r.sales === u)?.saldo) || 0);
      const tunggu = rp(Number(menunggu.find((m) => m.sales === u)?.jumlah) || 0);
      return { sales: u, nama: namaDari(u), saldo, menunggu: tunggu, tersedia: Math.max(0, rp(saldo - tunggu)) };
    })
    .sort((a, b) => b.saldo - a.saldo);
}

export interface AjukanInput {
  username: string;
  nama: string;
  divisi: string;
  jumlah: number;
  metode: 'tunai' | 'transfer';
  tanggal: Date;
  catatan: string | null;
}

export async function ajukanSetoran(tx: Tx, p: AjukanInput) {
  const jumlah = rp(p.jumlah);
  if (!Number.isFinite(jumlah) || jumlah <= 0) throw new BusinessError('Jumlah setoran harus lebih dari 0');
  // Satu pengajuan per sales diproses berurutan: dua klik bersamaan tidak bisa melebihi saldo
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'setoran:' + p.username}))`);
  const [s] = await saldoSales(tx, p.divisi, p.username);
  if (jumlah > s.tersedia + TOLERANSI) {
    throw new BusinessError(
      `Setoran Rp ${jumlah.toLocaleString('id-ID')} melebihi kas yang bisa disetor Rp ${s.tersedia.toLocaleString('id-ID')}` +
        (s.menunggu > 0 ? ` (Rp ${s.menunggu.toLocaleString('id-ID')} masih menunggu konfirmasi)` : '')
    );
  }
  const noSetoran = await nomorUrut(tx, 'STR', p.tanggal);
  const [row] = await tx
    .insert(setoranSales)
    .values({
      noSetoran,
      tanggal: p.tanggal,
      sales: p.username,
      namaSales: p.nama,
      divisi: entitasDari(p.divisi),
      jumlah: String(jumlah),
      metode: p.metode,
      catatan: p.catatan,
    })
    .returning();
  await tx.insert(logs).values({
    user: p.nama,
    aksi: 'AJUKAN_SETORAN',
    detail: `Setoran ${noSetoran}: Rp ${jumlah.toLocaleString('id-ID')} (${p.metode}) dari ${p.nama}`,
  });
  return row;
}

async function kunci(tx: Tx, id: string) {
  const [r] = await tx.select().from(setoranSales).where(eq(setoranSales.id, id)).for('update').limit(1);
  if (!r) throw new BusinessError('Setoran tidak ditemukan', 404);
  if (r.status !== 'menunggu') throw new BusinessError(`Setoran ${r.noSetoran} sudah ${r.status}`);
  return r;
}

/** Pemisahan tugas: yang menyetor tidak boleh mengonfirmasi/menolak setorannya sendiri. */
function bukanSendiri(r: { sales: string; noSetoran: string }, username: string) {
  if (r.sales === username) {
    throw new BusinessError(`Setoran ${r.noSetoran} adalah setoran Anda sendiri. Minta Finance/pimpinan lain yang memprosesnya.`, 403);
  }
}

/** Finance menerima uangnya: Dr Kas/Bank (+ Selisih Kas bila kurang), Cr Kas di Tangan Sales. */
export async function konfirmasiSetoran(tx: Tx, id: string, jumlahDiterima: number | undefined, user: { username: string; nama: string }) {
  const r = await kunci(tx, id);
  bukanSendiri(r, user.username);
  const jumlah = rp(Number(r.jumlah));
  const diterima = rp(jumlahDiterima === undefined ? jumlah : jumlahDiterima);
  if (!Number.isFinite(diterima) || diterima <= 0) throw new BusinessError('Jumlah diterima harus lebih dari 0');
  if (diterima > jumlah + TOLERANSI) throw new BusinessError('Jumlah diterima tidak boleh melebihi yang disetor sales');
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'setoran:' + r.sales}))`);
  const [s] = await saldoSales(tx, r.divisi, r.sales);
  // Saldo sudah termasuk setoran ini sebagai "menunggu"; yang dicek: kas yang dipegang cukup menutup setoran
  if (jumlah > s.saldo + TOLERANSI) {
    throw new BusinessError(
      `Kas di tangan ${r.namaSales} hanya Rp ${s.saldo.toLocaleString('id-ID')} (ada transaksi yang dibatalkan). Tolak setoran ini lalu minta sales mengajukan ulang.`
    );
  }
  const selisih = rp(jumlah - diterima);
  const kas = r.metode === 'transfer' ? AKUN.BANK : AKUN.KAS_TUNAI;
  const jurnalId = await posting(tx, {
    tanggal: new Date(),
    divisi: r.divisi,
    cabang: 'Pusat',
    sumber: 'SETORAN',
    referensi: r.noSetoran,
    keterangan: `Setoran ${r.noSetoran} dari ${r.namaSales} (${r.metode})${selisih > 0 ? `, kurang Rp ${selisih.toLocaleString('id-ID')}` : ''}`,
    user: user.nama,
    manual: true,
    baris: [
      { akun: kas, debit: diterima },
      { akun: AKUN.SELISIH_KAS, debit: selisih },
      { akun: AKUN.KAS_SALES, kredit: jumlah, sales: r.sales },
    ],
  });
  const [baru] = await tx
    .update(setoranSales)
    .set({ status: 'dikonfirmasi', jumlahDiterima: String(diterima), diprosesOleh: user.username, diprosesAt: new Date(), jurnalId })
    .where(and(eq(setoranSales.id, id), eq(setoranSales.status, 'menunggu')))
    .returning();
  if (!baru) throw new BusinessError('Setoran sudah diproses pengguna lain', 409);
  await tx.insert(logs).values({
    user: user.nama,
    aksi: 'KONFIRMASI_SETORAN',
    detail: `Konfirmasi ${r.noSetoran} dari ${r.namaSales}: diterima Rp ${diterima.toLocaleString('id-ID')} dari Rp ${jumlah.toLocaleString('id-ID')}`,
  });
  return baru;
}

export async function tolakSetoran(tx: Tx, id: string, alasan: string, user: { username: string; nama: string }) {
  const a = alasan.trim();
  if (!a) throw new BusinessError('Alasan penolakan wajib diisi');
  const r = await kunci(tx, id);
  bukanSendiri(r, user.username);
  const [baru] = await tx
    .update(setoranSales)
    .set({ status: 'ditolak', alasanTolak: a.slice(0, 500), diprosesOleh: user.username, diprosesAt: new Date() })
    .where(eq(setoranSales.id, id))
    .returning();
  await tx.insert(logs).values({ user: user.nama, aksi: 'TOLAK_SETORAN', detail: `Tolak ${r.noSetoran} dari ${r.namaSales}: ${a}` });
  return baru;
}

/** Sales membatalkan pengajuannya sendiri selama masih menunggu. */
export async function batalSetoran(tx: Tx, id: string, username: string) {
  const r = await kunci(tx, id);
  if (r.sales !== username) throw new BusinessError('Hanya pengaju yang bisa membatalkan setoran ini', 403);
  const [baru] = await tx
    .update(setoranSales)
    .set({ status: 'dibatalkan', diprosesOleh: username, diprosesAt: new Date() })
    .where(eq(setoranSales.id, id))
    .returning();
  await tx.insert(logs).values({ user: r.namaSales, aksi: 'BATAL_SETORAN', detail: `Batalkan ${r.noSetoran}` });
  return baru;
}

export async function daftarSetoran(ex: Executor, divisi: string, opsi: { sales?: string; status?: string }) {
  const syarat = [eq(setoranSales.divisi, entitasDari(divisi))];
  if (opsi.sales) syarat.push(eq(setoranSales.sales, opsi.sales));
  if (opsi.status && opsi.status !== 'semua') syarat.push(eq(setoranSales.status, opsi.status));
  const rows = await ex.select().from(setoranSales).where(and(...syarat)).orderBy(desc(setoranSales.createdAt)).limit(300);
  return rows.map((r) => ({
    id: r.id,
    noSetoran: r.noSetoran,
    tanggal: r.tanggal,
    sales: r.sales,
    namaSales: r.namaSales,
    jumlah: Number(r.jumlah),
    metode: r.metode,
    catatan: r.catatan,
    status: r.status,
    jumlahDiterima: r.jumlahDiterima === null ? null : Number(r.jumlahDiterima),
    diprosesOleh: r.diprosesOleh,
    diprosesAt: r.diprosesAt,
    alasanTolak: r.alasanTolak,
  }));
}

/** Asal-usul kas di tangan seorang sales: setiap mutasi akun 1-1350 (penjualan, batal, setoran, dll). */
export async function rincianKasSales(ex: Executor, divisi: string, sales: string) {
  const rows = (await ex.execute(sql`
    SELECT j.tanggal, j.no_jurnal, j.sumber, j.referensi, j.keterangan, (b.debit - b.kredit)::float8 AS jumlah
    FROM jurnal_baris b JOIN jurnal j ON j.id = b.jurnal_id
    WHERE b.akun_kode = ${AKUN.KAS_SALES} AND b.sales = ${sales} AND j.entitas = ${entitasDari(divisi)}
    ORDER BY j.tanggal DESC, j.created_at DESC
    LIMIT 200
  `)) as unknown as { tanggal: string | Date; no_jurnal: string; sumber: string; referensi: string | null; keterangan: string; jumlah: number }[];
  return rows.map((r) => ({
    // kolom timestamp tanpa zona menyimpan UTC
    tanggal: r.tanggal instanceof Date ? r.tanggal.toISOString() : new Date(String(r.tanggal).replace(' ', 'T') + 'Z').toISOString(),
    noJurnal: r.no_jurnal,
    sumber: LABEL_SUMBER[r.sumber] ?? r.sumber,
    referensi: r.referensi,
    keterangan: r.keterangan,
    jumlah: rp(Number(r.jumlah)),
  }));
}
