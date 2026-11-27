import { and, count, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { akun, biayaLampiran, biayaOperasional, keuangan, logs, users } from '@/shared/lib/db/schema';
import { BusinessError } from '@/shared/lib/stock';
import { nomorUrut } from '@/shared/lib/nomor-urut';
import { AKUN, adalahFinancePusat, akunKas, balikJurnal, cabangFranchise, entitasDari, posting, wajibAkunPosting } from '@/shared/lib/jurnal';
import { hariIniWib } from '@/shared/lib/laporan-keuangan';
import { saldoSales } from '@/shared/lib/setoran';
import { keWebp } from '@/shared/lib/webp';
import { punyaRole } from '@/shared/lib/auth/roles';
import { bolehAkunBiaya, MAKS_FOTO, MAKS_PANJANG_FOTO, POLA_FOTO, SUMBER_BIAYA, type ItemBiaya, type SumberBiaya } from '@/shared/lib/biaya-aturan';

// ============================================================
// Biaya operasional: karyawan input -> Finance Pusat memeriksa nota -> dibukukan.
//   penjualan : Dr Beban, Cr 1-1350 (kas penjual)     -> setoran berkurang
//   kantor    : Dr Beban, Cr Kas/Bank
//   pribadi   : Dr Beban, Cr 2-1500 Hutang Reimburse  -> reimburse: Dr 2-1500, Cr Kas/Bank
// ============================================================

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;
export interface Pelaku {
  username: string;
  nama: string;
}

const rp = (n: number) => Math.round(n * 100) / 100;
const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const metodeDari = (m: unknown) => (m === 'transfer' ? ('transfer' as const) : ('tunai' as const));

/** Validasi foto kiriman browser lalu simpan sebagai WebP. */
export async function bacaFoto(mentah: unknown): Promise<string[]> {
  if (mentah === undefined || mentah === null) return [];
  if (!Array.isArray(mentah) || mentah.length > MAKS_FOTO) throw new BusinessError(`Maksimal ${MAKS_FOTO} foto`);
  const hasil: string[] = [];
  // berurutan: tiga foto besar sekaligus memakan memori server
  for (const f of mentah) {
    if (typeof f !== 'string' || f.length > MAKS_PANJANG_FOTO || !POLA_FOTO.test(f)) {
      throw new BusinessError('Foto tidak valid atau terlalu besar (gunakan JPG/PNG)');
    }
    hasil.push(await keWebp(f, { lebar: 1400, tinggi: 1400, fit: 'inside', mutu: 78 }));
  }
  return hasil;
}

export interface InputBiayaBaru {
  tanggal: Date;
  akunKode: string;
  jumlah: number;
  keterangan: string;
  sumber: string;
  metode?: string;
  divisi: string;
  cabang: string;
  foto?: unknown;
}

export async function ajukanBiaya(tx: Tx, p: InputBiayaBaru, user: Pelaku) {
  const jumlah = rp(p.jumlah);
  if (!Number.isFinite(jumlah) || jumlah <= 0) throw new BusinessError('Nominal harus lebih dari 0');
  if (jumlah > 1e12) throw new BusinessError('Nominal terlalu besar');
  if (Number.isNaN(p.tanggal.getTime())) throw new BusinessError('Tanggal tidak valid');
  // tanggal ke depan membuat kas penjual sudah berkurang tetapi neraca hari ini belum
  if (hariIniWib(p.tanggal) > hariIniWib()) throw new BusinessError('Tanggal biaya tidak boleh melewati hari ini');
  if (await cabangFranchise(tx, p.cabang || 'Pusat')) {
    throw new BusinessError('Biaya cabang franchise milik pewaralaba, tidak dicatat di pembukuan perusahaan');
  }
  const sumber = p.sumber as SumberBiaya;
  if (!SUMBER_BIAYA.includes(sumber)) throw new BusinessError('Pilih sumber uang yang dipakai');
  const keterangan = p.keterangan.trim().slice(0, 500);
  if (!keterangan) throw new BusinessError('Keterangan wajib diisi');
  if (!bolehAkunBiaya(p.akunKode)) throw new BusinessError('Jenis biaya ini tidak bisa diinput');
  const a = await wajibAkunPosting(tx, p.akunKode);
  if (a.tipe !== 'BEBAN') throw new BusinessError('Pilih akun beban operasional (6-xxxx)');
  const foto = await bacaFoto(p.foto);
  const divisi = entitasDari(p.divisi);

  if (sumber === 'penjualan') {
    // kunci yang sama dengan pengajuan setoran: uang yang sama tidak bisa dipakai dua kali
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'setoran:' + user.username}))`);
    const [s] = await saldoSales(tx, divisi, user.username);
    if (jumlah > s.tersedia + 0.009) {
      throw new BusinessError(`Uang penjualan yang Anda pegang hanya ${rupiah(s.tersedia)}. Pilih sumber lain, misalnya uang pribadi (reimburse).`);
    }
  }

  const noBiaya = await nomorUrut(tx, 'BOP', p.tanggal);
  const [row] = await tx
    .insert(biayaOperasional)
    .values({
      noBiaya, tanggal: p.tanggal, kategori: a.nama, jumlah: String(jumlah), divisi, cabang: p.cabang || 'Pusat',
      keterangan, akunKode: a.kode, sumber, metode: sumber === 'kantor' ? metodeDari(p.metode) : 'tunai',
      status: 'menunggu', username: user.username, createdBy: user.nama.slice(0, 50),
    })
    .returning();
  if (foto.length) await tx.insert(biayaLampiran).values(foto.map((data) => ({ biayaId: row.id, data, oleh: user.username })));
  await tx.insert(logs).values({ user: user.nama, aksi: 'AJUKAN_BIAYA', detail: `${noBiaya} ${a.nama} ${rupiah(jumlah)} (${sumber})` });
  return row;
}

async function kunci(tx: Tx, id: string) {
  const [r] = await tx.select().from(biayaOperasional).where(eq(biayaOperasional.id, id)).for('update').limit(1);
  if (!r) throw new BusinessError('Biaya tidak ditemukan', 404);
  return r;
}
type Baris = Awaited<ReturnType<typeof kunci>>;

/**
 * Hanya Finance Pusat yang memproses, dan tidak boleh memproses biayanya sendiri.
 * Biaya milik Finance Pusat diproses Direktur Utama (kalau tidak, tidak ada yang bisa).
 */
async function wajibPemroses(tx: Tx, r: Baris, username: string) {
  const daftar = await tx
    .select({ username: users.username, role: users.role, rolesTambahan: users.rolesTambahan, cabang: users.cabang, aktif: users.aktif })
    .from(users);
  const saya = daftar.find((u) => u.username === username);
  const pemilik = daftar.find((u) => u.username === r.username);
  if (!saya?.aktif) throw new BusinessError('Akun tidak aktif', 403);
  if (r.username === username) throw new BusinessError('Biaya Anda sendiri harus diproses orang lain', 403);
  if (adalahFinancePusat(saya)) return;
  if (adalahFinancePusat(pemilik) && punyaRole({ role: saya.role, roles: saya.rolesTambahan }, ['Direktur Utama'])) return;
  throw new BusinessError('Hanya akun Finance Pusat yang boleh memproses biaya', 403);
}

async function jumlahNota(tx: Tx, id: string) {
  const [r] = await tx.select({ n: count() }).from(biayaLampiran).where(and(eq(biayaLampiran.biayaId, id), eq(biayaLampiran.jenis, 'nota')));
  return Number(r?.n ?? 0);
}

async function kasKeluar(tx: Tx, r: Baris, jumlah: number, tanggal: Date, keterangan: string, oleh: string) {
  const [kk] = await tx
    .insert(keuangan)
    .values({ tanggal, jenis: 'keluar', kategori: r.kategori, jumlah: String(jumlah), divisi: r.divisi, cabang: r.cabang, keterangan, createdBy: oleh })
    .returning({ id: keuangan.id });
  return kk.id;
}

export async function setujuiBiaya(tx: Tx, id: string, notaFisik: boolean, user: Pelaku) {
  const r = await kunci(tx, id);
  if (r.status !== 'menunggu') throw new BusinessError(`Biaya ${r.noBiaya} sudah ${r.status}`);
  await wajibPemroses(tx, r, user.username);
  if ((await jumlahNota(tx, id)) === 0) throw new BusinessError('Belum ada foto nota / invoice. Minta karyawan mengunggahnya dulu.');
  if (notaFisik !== true) throw new BusinessError('Centang bahwa nota / invoice fisik sudah diterima');
  const jumlah = rp(Number(r.jumlah));

  let kredit: { akun: string; sales?: string };
  if (r.sumber === 'penjualan') {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'setoran:' + r.username}))`);
    const [s] = await saldoSales(tx, r.divisi, r.username!);
    if (jumlah > s.saldo + 0.009) throw new BusinessError(`Kas yang dipegang ${r.createdBy} hanya ${rupiah(s.saldo)} (ada transaksi yang dibatalkan)`);
    kredit = { akun: AKUN.KAS_SALES, sales: r.username! };
  } else if (r.sumber === 'pribadi') {
    kredit = { akun: AKUN.HUTANG_REIMBURSE };
  } else {
    kredit = { akun: akunKas(r.metode) };
  }

  await posting(tx, {
    tanggal: r.tanggal, divisi: r.divisi, cabang: r.cabang, sumber: 'BIAYA', referensi: r.id,
    keterangan: `${r.noBiaya} ${r.kategori}: ${r.keterangan} (${r.createdBy})`, user: user.nama, manual: true,
    baris: [
      { akun: r.akunKode!, debit: jumlah },
      { akun: kredit.akun, kredit: jumlah, sales: kredit.sales },
    ],
  });
  // Buku kas: uang pribadi belum mengurangi kas perusahaan sampai direimburse
  const keuanganId = r.sumber === 'pribadi' ? null : await kasKeluar(tx, r, jumlah, r.tanggal, `Biaya ${r.noBiaya} (${r.createdBy}): ${r.keterangan}`, user.username);
  await tx
    .update(biayaOperasional)
    .set({ status: 'disetujui', notaFisik: true, diprosesOleh: user.username, diprosesAt: new Date(), keuanganId })
    .where(eq(biayaOperasional.id, id));
  await tx.insert(logs).values({ user: user.nama, aksi: 'SETUJUI_BIAYA', detail: `${r.noBiaya} ${rupiah(jumlah)} milik ${r.createdBy}, nota fisik diterima` });
}

export async function tolakBiaya(tx: Tx, id: string, alasan: string, user: Pelaku) {
  const a = alasan.trim().slice(0, 500);
  if (!a) throw new BusinessError('Alasan penolakan wajib diisi');
  const r = await kunci(tx, id);
  if (r.status !== 'menunggu') throw new BusinessError(`Biaya ${r.noBiaya} sudah ${r.status}`);
  await wajibPemroses(tx, r, user.username);
  await tx.update(biayaOperasional).set({ status: 'ditolak', alasanTolak: a, diprosesOleh: user.username, diprosesAt: new Date() }).where(eq(biayaOperasional.id, id));
  await tx.insert(logs).values({ user: user.nama, aksi: 'TOLAK_BIAYA', detail: `${r.noBiaya} milik ${r.createdBy}: ${a}` });
}

/** Koreksi biaya yang sudah disetujui (belum direimburse): jurnal dibalik, kas dikembalikan. */
export async function batalkanDisetujui(tx: Tx, id: string, alasan: string, user: Pelaku) {
  const a = alasan.trim().slice(0, 500);
  if (!a) throw new BusinessError('Alasan pembatalan wajib diisi');
  const r = await kunci(tx, id);
  if (r.status !== 'disetujui') throw new BusinessError('Hanya biaya berstatus disetujui yang bisa dibatalkan');
  await wajibPemroses(tx, r, user.username);
  const dibalik = await balikJurnal(tx, { referensi: r.id, sumber: ['BIAYA'], keterangan: `Batalkan biaya ${r.noBiaya ?? r.kategori}: ${a}`, user: user.nama });
  // tanpa jurnal yang bisa dibalik, menghapus buku kas akan membuatnya beda dengan buku besar
  if (!dibalik) throw new BusinessError('Biaya ini tidak punya jurnal sendiri. Koreksi lewat jurnal manual.');
  await tx.update(biayaOperasional).set({ status: 'dibatalkan', alasanTolak: a, diprosesOleh: user.username, diprosesAt: new Date(), keuanganId: null }).where(eq(biayaOperasional.id, id));
  if (r.keuanganId) await tx.delete(keuangan).where(eq(keuangan.id, r.keuanganId));
  await tx.insert(logs).values({ user: user.nama, aksi: 'BATALKAN_BIAYA', detail: `${r.noBiaya ?? r.kategori}: ${a}` });
}

/** Ganti uang pribadi karyawan dari Kas / Bank perusahaan. */
export async function reimburseBiaya(tx: Tx, id: string, metode: unknown, foto: unknown, user: Pelaku) {
  const r = await kunci(tx, id);
  if (r.sumber !== 'pribadi') throw new BusinessError('Hanya biaya dari uang pribadi yang direimburse');
  if (r.status !== 'disetujui') throw new BusinessError(r.status === 'dibayar' ? 'Biaya ini sudah direimburse' : 'Biaya belum disetujui');
  await wajibPemroses(tx, r, user.username);
  if (!r.notaFisik || (await jumlahNota(tx, id)) === 0) throw new BusinessError('Reimburse butuh bukti nota / invoice');
  const jumlah = rp(Number(r.jumlah));
  const cara = metodeDari(metode);
  const tanggal = new Date();
  const bukti = await bacaFoto(foto);
  await posting(tx, {
    tanggal, divisi: r.divisi, cabang: r.cabang, sumber: 'REIMBURSE', referensi: r.id,
    keterangan: `Reimburse ${r.noBiaya} ke ${r.createdBy} (${cara})`, user: user.nama, manual: true,
    baris: [
      { akun: AKUN.HUTANG_REIMBURSE, debit: jumlah },
      { akun: akunKas(cara), kredit: jumlah },
    ],
  });
  const keuanganId = await kasKeluar(tx, r, jumlah, tanggal, `Reimburse ${r.noBiaya} ke ${r.createdBy}`, user.username);
  if (bukti.length) await tx.insert(biayaLampiran).values(bukti.map((data) => ({ biayaId: id, jenis: 'bayar', data, oleh: user.username })));
  await tx
    .update(biayaOperasional)
    .set({ status: 'dibayar', reimburseOleh: user.username, reimburseAt: tanggal, reimburseMetode: cara, keuanganId })
    .where(eq(biayaOperasional.id, id));
  await tx.insert(logs).values({ user: user.nama, aksi: 'REIMBURSE_BIAYA', detail: `${r.noBiaya} ${rupiah(jumlah)} ke ${r.createdBy} via ${cara}` });
}

/** Karyawan membatalkan pengajuannya selama masih menunggu. */
export async function batalPengajuan(tx: Tx, id: string, user: Pelaku) {
  const r = await kunci(tx, id);
  if (r.username !== user.username) throw new BusinessError('Hanya pengaju yang bisa membatalkan', 403);
  if (r.status !== 'menunggu') throw new BusinessError(`Biaya ${r.noBiaya} sudah ${r.status}`);
  await tx.update(biayaOperasional).set({ status: 'dibatalkan', diprosesOleh: user.username, diprosesAt: new Date() }).where(eq(biayaOperasional.id, id));
  await tx.insert(logs).values({ user: user.nama, aksi: 'BATAL_BIAYA', detail: `${r.noBiaya} dibatalkan pengaju` });
}

export async function tambahNota(tx: Tx, id: string, foto: unknown, user: Pelaku) {
  const r = await kunci(tx, id);
  if (r.username !== user.username) throw new BusinessError('Hanya pengaju yang bisa menambah foto nota', 403);
  if (r.status !== 'menunggu') throw new BusinessError('Foto nota hanya bisa ditambah selama menunggu persetujuan');
  const baru = await bacaFoto(foto);
  if (!baru.length) throw new BusinessError('Pilih foto terlebih dahulu');
  if ((await jumlahNota(tx, id)) + baru.length > MAKS_FOTO) throw new BusinessError(`Maksimal ${MAKS_FOTO} foto per biaya`);
  await tx.insert(biayaLampiran).values(baru.map((data) => ({ biayaId: id, data, oleh: user.username })));
}

/** Baris mentah SQL daftarBiaya. */
interface BarisDaftar {
  id: string; no_biaya: string | null; tanggal: string | Date; akun_kode: string | null; kategori: string; jumlah: string;
  keterangan: string | null; sumber: ItemBiaya['sumber']; metode: ItemBiaya['metode']; status: ItemBiaya['status'];
  username: string | null; created_by: string | null; nota_fisik: boolean; jumlah_foto: number; diproses_oleh: string | null;
  alasan_tolak: string | null; reimburse_oleh: string | null; reimburse_at: string | Date | null; reimburse_metode: string | null;
}

export async function daftarBiaya(ex: Executor, opsi: { divisi: string; username?: string; dari?: Date; sampai?: Date }): Promise<ItemBiaya[]> {
  const syarat: SQL[] = [sql`b.divisi = ${entitasDari(opsi.divisi)}`];
  if (opsi.username) syarat.push(sql`b.username = ${opsi.username}`);
  // yang masih perlu tindakan selalu ikut, apa pun periodenya
  if (opsi.dari && opsi.sampai) {
    syarat.push(sql`(b.status = 'menunggu' OR (b.status = 'disetujui' AND b.sumber = 'pribadi') OR (b.tanggal >= ${opsi.dari.toISOString()}::timestamp AND b.tanggal < ${opsi.sampai.toISOString()}::timestamp))`);
  }
  // Laporan berperiode dipakai untuk total: tidak boleh terpotong. Daftar "Biaya Saya" dibatasi,
  // tetapi yang masih perlu tindakan didahulukan agar tidak pernah hilang dari halaman.
  const urutan = opsi.dari && opsi.sampai
    ? sql`ORDER BY b.tanggal DESC, b.created_at DESC`
    : sql`ORDER BY (b.status = 'menunggu' OR (b.status = 'disetujui' AND b.sumber = 'pribadi')) DESC, b.tanggal DESC, b.created_at DESC LIMIT 500`;
  const rows = (await ex.execute(sql`
    SELECT b.*, (SELECT count(*)::int FROM biaya_lampiran l WHERE l.biaya_id = b.id) AS jumlah_foto
    FROM biaya_operasional b
    WHERE ${sql.join(syarat, sql` AND `)}
    ${urutan}
  `)) as unknown as BarisDaftar[];
  // kolom timestamp tanpa zona menyimpan UTC
  const iso = (v: unknown) => (v ? (v instanceof Date ? v : new Date(String(v).replace(' ', 'T') + 'Z')).toISOString() : null);
  return rows.map((r) => ({
    id: r.id, noBiaya: r.no_biaya, tanggal: iso(r.tanggal)!, akunKode: r.akun_kode, kategori: r.kategori, jumlah: Number(r.jumlah),
    keterangan: r.keterangan, sumber: r.sumber, metode: r.metode, status: r.status, username: r.username, nama: r.created_by,
    notaFisik: r.nota_fisik, jumlahFoto: r.jumlah_foto, diprosesOleh: r.diproses_oleh, alasanTolak: r.alasan_tolak,
    reimburseOleh: r.reimburse_oleh, reimburseAt: iso(r.reimburse_at), reimburseMetode: r.reimburse_metode,
  }));
}

export async function pilihanAkunBiaya(ex: Executor) {
  const rows = await ex.select({ kode: akun.kode, nama: akun.nama }).from(akun).where(and(eq(akun.tipe, 'BEBAN'), eq(akun.posting, true), eq(akun.aktif, true))).orderBy(akun.kode);
  return rows.filter((a) => bolehAkunBiaya(a.kode));
}
