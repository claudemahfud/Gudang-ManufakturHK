import { sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { AKUN, LABEL_SUMBER, type Entitas } from '@/shared/lib/jurnal';

// ============================================================
// Laporan keuangan dari buku besar (jurnal), per entitas, tanggal WIB.
// Neraca, Laba Rugi, Arus Kas metode langsung, Jurnal Umum, Buku Besar, Ringkasan kesehatan.
// ============================================================

type Executor = typeof db;
const rp = (n: number) => Math.round(n * 100) / 100;
const nol = (n: number) => Math.abs(n) < 0.005;

/** 'YYYY-MM-DD' (WIB) -> awal hari itu dalam waktu UTC (kolom timestamp disimpan UTC). */
export function awalHariWib(tgl: string) {
  const d = new Date(`${tgl}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) throw new Error(`Tanggal tidak valid: ${tgl}`);
  return d;
}
const HARI = 86_400_000;
export const akhirHariWib = (tgl: string) => new Date(awalHariWib(tgl).getTime() + HARI); // eksklusif
/** Parameter waktu untuk SQL mentah (driver tidak menerima objek Date); kolom timestamp menyimpan UTC. */
const ts = (d: Date) => sql`${d.toISOString()}::timestamp`;
export const tsWib = ts;

/** Tanggal hari ini (WIB) 'YYYY-MM-DD'. */
export function hariIniWib(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);
}

/** Validasi & normalisasi query tanggal; kosong -> bawaan. */
export function tanggalQuery(v: string | null, bawaan: string) {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : bawaan;
}

type AkunSaldo = {
  kode: string;
  nama: string;
  tipe: string;
  saldo_normal: string;
  kelompok: string;
  arus_kas: string | null;
  urutan: number;
  d: number;
  k: number;
};

/** Mutasi debit/kredit per akun posting dalam rentang [dari, sampai). dari null = sejak awal. */
async function mutasiAkun(ex: Executor, entitas: Entitas, dari: Date | null, sampai: Date) {
  const rows = (await ex.execute(sql`
    SELECT a.kode, a.nama, a.tipe, a.saldo_normal, a.kelompok, a.arus_kas, a.urutan,
           COALESCE(SUM(m.debit), 0)::float8 AS d, COALESCE(SUM(m.kredit), 0)::float8 AS k
    FROM akun a
    LEFT JOIN (
      SELECT b.akun_kode, b.debit, b.kredit
      FROM jurnal_baris b JOIN jurnal j ON j.id = b.jurnal_id
      WHERE j.entitas = ${entitas} AND j.tanggal < ${ts(sampai)}
        ${dari ? sql`AND j.tanggal >= ${ts(dari)}` : sql``}
    ) m ON m.akun_kode = a.kode
    WHERE a.posting
    GROUP BY a.kode
    ORDER BY a.urutan
  `)) as unknown as AkunSaldo[];
  return rows.map((r) => ({ ...r, d: Number(r.d), k: Number(r.k) }));
}

/** Saldo bertanda alami: aset & beban = debit - kredit; kewajiban, ekuitas, pendapatan = kredit - debit. */
const saldoDebit = (r: { d: number; k: number }) => rp(r.d - r.k);
const saldoKredit = (r: { d: number; k: number }) => rp(r.k - r.d);

type Kelompok = { nama: string; akun: { kode: string; nama: string; saldo: number }[]; total: number };

function kelompokkan(rows: AkunSaldo[], saldo: (r: AkunSaldo) => number): Kelompok[] {
  const urut: string[] = [];
  const per = new Map<string, Kelompok>();
  for (const r of rows) {
    const s = saldo(r);
    if (nol(s)) continue;
    if (!per.has(r.kelompok)) {
      per.set(r.kelompok, { nama: r.kelompok, akun: [], total: 0 });
      urut.push(r.kelompok);
    }
    const g = per.get(r.kelompok)!;
    g.akun.push({ kode: r.kode, nama: r.nama, saldo: s });
    g.total = rp(g.total + s);
  }
  return urut.map((n) => per.get(n)!);
}

const jumlahTotal = (g: Kelompok[]) => rp(g.reduce((s, x) => s + x.total, 0));

/** Laba bersih dari mutasi (pendapatan - beban). */
function labaDari(rows: AkunSaldo[]) {
  let laba = 0;
  for (const r of rows) {
    if (r.tipe === 'PENDAPATAN') laba += r.k - r.d;
    else if (r.tipe === 'BEBAN') laba -= r.d - r.k;
  }
  return rp(laba);
}

// ------------------------------------------------------------
// NERACA
// ------------------------------------------------------------
export async function neraca(entitas: Entitas, per: string, ex: Executor = db) {
  const rows = await mutasiAkun(ex, entitas, null, akhirHariWib(per));
  const aset = kelompokkan(rows.filter((r) => r.tipe === 'ASET'), saldoDebit);
  const kewajiban = kelompokkan(rows.filter((r) => r.tipe === 'KEWAJIBAN'), saldoKredit);
  const ekuitas = kelompokkan(rows.filter((r) => r.tipe === 'EKUITAS'), saldoKredit);
  const labaBerjalan = labaDari(rows);
  if (!nol(labaBerjalan)) {
    let g = ekuitas.find((x) => x.nama === 'Ekuitas');
    if (!g) {
      g = { nama: 'Ekuitas', akun: [], total: 0 };
      ekuitas.push(g);
    }
    g.akun.push({ kode: '', nama: 'Laba (Rugi) Berjalan', saldo: labaBerjalan });
    g.total = rp(g.total + labaBerjalan);
  }

  const totalAset = jumlahTotal(aset);
  const totalKewajiban = jumlahTotal(kewajiban);
  const totalEkuitas = jumlahTotal(ekuitas);
  const selisih = rp(totalAset - totalKewajiban - totalEkuitas);

  const persediaanBuku = rp(
    rows.filter((r) => r.kode === AKUN.PERSEDIAAN || r.kode === '1-1510').reduce((s, r) => s + r.d - r.k, 0)
  );
  // Pembanding: stok fisik milik perusahaan (tanpa outlet franchise) x HPP rata-rata saat ini
  const [fisik] = (await ex.execute(sql`
    SELECT COALESCE(SUM(sc.stok * COALESCE(i.harga_beli, 0)), 0)::float8 AS nilai
    FROM stok_cabang sc
    JOIN inventory i ON i.sku = sc.sku
    LEFT JOIN master_cabang mc ON mc.nama_cabang = sc.cabang
    WHERE i.divisi = ${entitas} AND COALESCE(mc.tipe, '') <> 'FRANCHISE'
  `)) as unknown as { nilai: number }[];

  return {
    entitas,
    per,
    aset,
    kewajiban,
    ekuitas,
    totalAset,
    totalKewajiban,
    totalEkuitas,
    labaBerjalan,
    seimbang: nol(selisih),
    selisih,
    nilaiPersediaanFisik: rp(Number(fisik?.nilai) || 0),
    persediaanBuku,
  };
}

// ------------------------------------------------------------
// LABA RUGI
// ------------------------------------------------------------
type Baris = { kode: string; nama: string; jumlah: number };

function barisKelompok(rows: AkunSaldo[], kelompok: string, tanda: (r: AkunSaldo) => number): Baris[] {
  return rows
    .filter((r) => r.kelompok === kelompok)
    .map((r) => ({ kode: r.kode, nama: r.nama, jumlah: tanda(r) }))
    .filter((b) => !nol(b.jumlah));
}
const total = (b: Baris[]) => rp(b.reduce((s, x) => s + x.jumlah, 0));
const persen = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

export async function labaRugi(entitas: Entitas, dari: string, sampai: string, ex: Executor = db) {
  const rows = await mutasiAkun(ex, entitas, awalHariWib(dari), akhirHariWib(sampai));
  return hitungLabaRugi(rows, entitas, dari, sampai);
}

function hitungLabaRugi(rows: AkunSaldo[], entitas: Entitas, dari: string, sampai: string) {
  const pendapatan = barisKelompok(rows, 'Pendapatan Usaha', saldoKredit);
  const pengurang = barisKelompok(rows, 'Pengurang Pendapatan', saldoDebit);
  const hpp = barisKelompok(rows, 'Harga Pokok Penjualan', saldoDebit);
  const bebanOperasional = barisKelompok(rows, 'Beban Operasional', saldoDebit);
  const pendapatanLain = barisKelompok(rows, 'Pendapatan Lain', saldoKredit);
  const bebanLain = barisKelompok(rows, 'Beban Lain', saldoDebit);

  const totalPendapatan = total(pendapatan);
  const totalPengurang = total(pengurang);
  const pendapatanBersih = rp(totalPendapatan - totalPengurang);
  const totalHpp = total(hpp);
  const labaKotor = rp(pendapatanBersih - totalHpp);
  const totalBebanOperasional = total(bebanOperasional);
  const labaOperasional = rp(labaKotor - totalBebanOperasional);
  const lainBersih = rp(total(pendapatanLain) - total(bebanLain));
  const labaBersih = rp(labaOperasional + lainBersih);

  return {
    entitas,
    dari,
    sampai,
    pendapatan,
    totalPendapatan,
    pengurang,
    totalPengurang,
    pendapatanBersih,
    hpp,
    totalHpp,
    labaKotor,
    bebanOperasional,
    totalBebanOperasional,
    labaOperasional,
    pendapatanLain,
    bebanLain,
    lainBersih,
    labaBersih,
    marginKotor: persen(labaKotor, pendapatanBersih),
    marginBersih: persen(labaBersih, pendapatanBersih),
  };
}

// ------------------------------------------------------------
// ARUS KAS (metode langsung)
// ------------------------------------------------------------
type Seksi = 'OPERASI' | 'INVESTASI' | 'PENDANAAN';

/** Uraian arus kas per sumber transaksi otomatis. */
function uraianSumber(sumber: string, kas: number): { seksi: Seksi; uraian: string } | null {
  switch (sumber) {
    case 'POS':
    case 'FAKTUR':
    case 'BAYAR_PIUTANG':
    case 'BATAL_POS':
      return { seksi: 'OPERASI', uraian: 'Penerimaan kas dari pelanggan' };
    case 'RETUR':
      return { seksi: 'OPERASI', uraian: 'Pengembalian dana retur pelanggan' };
    case 'PEMBELIAN':
    case 'BATAL_PEMBELIAN':
    case 'BAYAR_HUTANG':
      return { seksi: 'OPERASI', uraian: 'Pembayaran kas kepada pemasok' };
    case 'BIAYA':
      return { seksi: 'OPERASI', uraian: 'Pembayaran beban operasional' };
    case 'KAS_OPNAME':
      return { seksi: 'OPERASI', uraian: kas >= 0 ? 'Kelebihan kas laci' : 'Kekurangan kas laci' };
    default:
      return null; // MANUAL / KAS_MANUAL: dari akun lawan
  }
}

/** Uraian arus kas dari akun lawan (jurnal manual & kas manual). */
function uraianAkun(a: { kode: string; nama: string; tipe: string; arus_kas: string | null }, kas: number): { seksi: Seksi; uraian: string } {
  const seksi: Seksi = a.arus_kas === 'INVESTASI' || a.arus_kas === 'PENDANAAN' ? a.arus_kas : 'OPERASI';
  const masuk = kas >= 0;
  if (a.kode === '3-1000') return { seksi, uraian: 'Setoran modal pemilik' };
  if (a.kode === '3-2000') return { seksi, uraian: 'Pengambilan prive pemilik' };
  if (a.kode.startsWith('2-2')) return { seksi, uraian: masuk ? 'Penerimaan pinjaman' : 'Pembayaran pinjaman' };
  if (seksi === 'INVESTASI') return { seksi, uraian: masuk ? 'Penjualan aset tetap' : 'Pembelian aset tetap' };
  if (a.kode === AKUN.HUTANG_USAHA) return { seksi, uraian: 'Pembayaran kas kepada pemasok' };
  if (a.kode === AKUN.PIUTANG) return { seksi, uraian: 'Penerimaan kas dari pelanggan' };
  if (a.tipe === 'BEBAN') return { seksi, uraian: 'Pembayaran beban operasional' };
  if (a.tipe === 'PENDAPATAN') return { seksi, uraian: masuk ? 'Penerimaan pendapatan lain' : 'Pengembalian pendapatan' };
  return { seksi, uraian: `${masuk ? 'Penerimaan' : 'Pembayaran'} ${a.nama}` };
}

async function saldoKas(ex: Executor, entitas: Entitas, sebelum: Date) {
  const rows = (await ex.execute(sql`
    SELECT a.kode, a.nama, COALESCE(SUM(b.debit - b.kredit), 0)::float8 AS saldo
    FROM akun a
    LEFT JOIN (
      SELECT b.akun_kode, b.debit, b.kredit FROM jurnal_baris b JOIN jurnal j ON j.id = b.jurnal_id
      WHERE j.entitas = ${entitas} AND j.tanggal < ${ts(sebelum)}
    ) b ON b.akun_kode = a.kode
    WHERE a.arus_kas = 'KAS' AND a.posting
    GROUP BY a.kode ORDER BY a.urutan
  `)) as unknown as { kode: string; nama: string; saldo: number }[];
  return rows.map((r) => ({ ...r, saldo: rp(Number(r.saldo)) }));
}

export async function arusKas(entitas: Entitas, dari: string, sampai: string, ex: Executor = db) {
  const mulai = awalHariWib(dari);
  const akhir = akhirHariWib(sampai);

  const baris = (await ex.execute(sql`
    SELECT j.id, j.sumber, COALESCE(o.sumber, j.sumber) AS sumber_asal,
           b.akun_kode, a.nama, a.tipe, a.arus_kas, (b.debit - b.kredit)::float8 AS net
    FROM jurnal j
    LEFT JOIN jurnal o ON o.id = j.pembalik_dari
    JOIN jurnal_baris b ON b.jurnal_id = j.id
    JOIN akun a ON a.kode = b.akun_kode
    WHERE j.entitas = ${entitas} AND j.tanggal >= ${ts(mulai)} AND j.tanggal < ${ts(akhir)}
      AND EXISTS (
        SELECT 1 FROM jurnal_baris kb JOIN akun ka ON ka.kode = kb.akun_kode
        WHERE kb.jurnal_id = j.id AND ka.arus_kas = 'KAS'
      )
  `)) as unknown as {
    id: string; sumber: string; sumber_asal: string; akun_kode: string; nama: string; tipe: string; arus_kas: string | null; net: number;
  }[];

  const perJurnal = new Map<string, typeof baris>();
  for (const b of baris) {
    if (!perJurnal.has(b.id)) perJurnal.set(b.id, []);
    perJurnal.get(b.id)!.push(b);
  }

  const seksi: Record<Seksi, Map<string, number>> = { OPERASI: new Map(), INVESTASI: new Map(), PENDANAAN: new Map() };
  for (const rows of perJurnal.values()) {
    const kas = rp(rows.filter((r) => r.arus_kas === 'KAS').reduce((s, r) => s + Number(r.net), 0));
    if (nol(kas)) continue; // pindah antar akun kas
    const asal = rows[0].sumber_asal;
    // Jurnal pembalik memakai uraian jurnal asalnya (tanda dibalik) agar saling hapus di baris yang sama
    const tandaUraian = rows[0].sumber === 'PEMBALIK' ? -kas : kas;
    let kelas = uraianSumber(asal, tandaUraian);
    if (!kelas) {
      const lawan = rows
        .filter((r) => r.arus_kas !== 'KAS')
        .sort((a, b) => Math.abs(Number(b.net)) - Math.abs(Number(a.net)))[0];
      kelas = lawan
        ? uraianAkun({ kode: lawan.akun_kode, nama: lawan.nama, tipe: lawan.tipe, arus_kas: lawan.arus_kas }, tandaUraian)
        : { seksi: 'OPERASI', uraian: 'Mutasi kas lain' };
    }
    const m = seksi[kelas.seksi];
    m.set(kelas.uraian, rp((m.get(kelas.uraian) ?? 0) + kas));
  }

  const ke = (m: Map<string, number>) => {
    const b = [...m.entries()].filter(([, j]) => !nol(j)).map(([uraian, jumlah]) => ({ uraian, jumlah }));
    return { baris: b, total: rp(b.reduce((s, x) => s + x.jumlah, 0)) };
  };
  const operasi = ke(seksi.OPERASI);
  const investasi = ke(seksi.INVESTASI);
  const pendanaan = ke(seksi.PENDANAAN);

  const awal = await saldoKas(ex, entitas, mulai);
  const akhirBuku = await saldoKas(ex, entitas, akhir);
  const saldoAwal = rp(awal.reduce((s, r) => s + r.saldo, 0));
  const kenaikanBersih = rp(operasi.total + investasi.total + pendanaan.total);
  const saldoAkhir = rp(saldoAwal + kenaikanBersih);
  const saldoAkhirBuku = rp(akhirBuku.reduce((s, r) => s + r.saldo, 0));

  return {
    entitas,
    dari,
    sampai,
    saldoAwal,
    operasi,
    investasi,
    pendanaan,
    kenaikanBersih,
    saldoAkhir,
    saldoAkhirBuku,
    cocok: nol(saldoAkhir - saldoAkhirBuku),
    perAkun: awal.map((a) => ({
      kode: a.kode,
      nama: a.nama,
      saldoAwal: a.saldo,
      saldoAkhir: akhirBuku.find((x) => x.kode === a.kode)?.saldo ?? 0,
    })),
  };
}

// ------------------------------------------------------------
// JURNAL UMUM & BUKU BESAR
// ------------------------------------------------------------
export async function daftarJurnal(
  entitas: Entitas,
  dari: string,
  sampai: string,
  opsi: { cari?: string | null; sumber?: string | null } = {},
  ex: Executor = db
) {
  const cari = opsi.cari?.trim();
  const heads = (await ex.execute(sql`
    SELECT j.id, j.no_jurnal, j.tanggal, j.entitas, j.cabang, j.sumber, j.referensi, j.keterangan,
           j.pembalik_dari, j.dibuat_oleh,
           EXISTS (SELECT 1 FROM jurnal p WHERE p.pembalik_dari = j.id) AS dibatalkan
    FROM jurnal j
    WHERE j.entitas = ${entitas} AND j.tanggal >= ${ts(awalHariWib(dari))} AND j.tanggal < ${ts(akhirHariWib(sampai))}
      ${opsi.sumber ? sql`AND j.sumber = ${opsi.sumber}` : sql``}
      ${cari ? sql`AND (j.no_jurnal ILIKE ${'%' + cari + '%'} OR j.referensi ILIKE ${'%' + cari + '%'} OR j.keterangan ILIKE ${'%' + cari + '%'})` : sql``}
    ORDER BY j.tanggal DESC, j.created_at DESC
    LIMIT 500
  `)) as unknown as {
    id: string; no_jurnal: string; tanggal: Date; entitas: string; cabang: string; sumber: string; referensi: string | null;
    keterangan: string; pembalik_dari: string | null; dibuat_oleh: string | null; dibatalkan: boolean;
  }[];
  if (!heads.length) return [];

  const ids = heads.map((h) => h.id);
  const baris = (await ex.execute(sql`
    SELECT b.jurnal_id, b.akun_kode, a.nama AS akun_nama, b.debit::float8 AS debit, b.kredit::float8 AS kredit, b.keterangan
    FROM jurnal_baris b JOIN akun a ON a.kode = b.akun_kode
    WHERE b.jurnal_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
    ORDER BY b.debit DESC, a.urutan
  `)) as unknown as { jurnal_id: string; akun_kode: string; akun_nama: string; debit: number; kredit: number; keterangan: string | null }[];

  return heads.map((h) => {
    const b = baris.filter((x) => x.jurnal_id === h.id);
    return {
      id: h.id,
      noJurnal: h.no_jurnal,
      tanggal: new Date(h.tanggal).toISOString(),
      entitas: h.entitas,
      cabang: h.cabang,
      sumber: h.sumber,
      sumberLabel: LABEL_SUMBER[h.sumber] ?? h.sumber,
      referensi: h.referensi,
      keterangan: h.keterangan,
      pembalikDari: h.pembalik_dari,
      dibatalkan: Boolean(h.dibatalkan),
      dibuatOleh: h.dibuat_oleh,
      total: rp(b.reduce((s, x) => s + Number(x.debit), 0)),
      baris: b.map((x) => ({
        akunKode: x.akun_kode,
        akunNama: x.akun_nama,
        debit: Number(x.debit),
        kredit: Number(x.kredit),
        keterangan: x.keterangan,
      })),
    };
  });
}

export async function bukuBesar(entitas: Entitas, kode: string, dari: string, sampai: string, ex: Executor = db) {
  const [a] = (await ex.execute(sql`SELECT kode, nama, saldo_normal FROM akun WHERE kode = ${kode}`)) as unknown as {
    kode: string; nama: string; saldo_normal: 'D' | 'K';
  }[];
  if (!a) return null;
  const tanda = a.saldo_normal === 'D' ? 1 : -1;
  const mulai = awalHariWib(dari);

  const [awal] = (await ex.execute(sql`
    SELECT COALESCE(SUM(b.debit - b.kredit), 0)::float8 AS net
    FROM jurnal_baris b JOIN jurnal j ON j.id = b.jurnal_id
    WHERE j.entitas = ${entitas} AND b.akun_kode = ${kode} AND j.tanggal < ${ts(mulai)}
  `)) as unknown as { net: number }[];
  const saldoAwal = rp(tanda * Number(awal?.net || 0));

  const rows = (await ex.execute(sql`
    SELECT j.tanggal, j.no_jurnal, j.sumber, j.referensi, COALESCE(b.keterangan, j.keterangan) AS keterangan,
           b.debit::float8 AS debit, b.kredit::float8 AS kredit
    FROM jurnal_baris b JOIN jurnal j ON j.id = b.jurnal_id
    WHERE j.entitas = ${entitas} AND b.akun_kode = ${kode} AND j.tanggal >= ${ts(mulai)} AND j.tanggal < ${ts(akhirHariWib(sampai))}
    ORDER BY j.tanggal, j.created_at, j.no_jurnal
    LIMIT 5000
  `)) as unknown as { tanggal: Date; no_jurnal: string; sumber: string; referensi: string | null; keterangan: string; debit: number; kredit: number }[];

  let saldo = saldoAwal;
  let totalDebit = 0;
  let totalKredit = 0;
  const mutasi = rows.map((r) => {
    const d = Number(r.debit);
    const k = Number(r.kredit);
    totalDebit += d;
    totalKredit += k;
    saldo = rp(saldo + tanda * (d - k));
    return {
      tanggal: new Date(r.tanggal).toISOString(),
      noJurnal: r.no_jurnal,
      sumber: r.sumber,
      referensi: r.referensi,
      keterangan: r.keterangan,
      debit: d,
      kredit: k,
      saldo,
    };
  });

  return {
    akun: { kode: a.kode, nama: a.nama, saldoNormal: a.saldo_normal },
    saldoAwal,
    mutasi,
    totalDebit: rp(totalDebit),
    totalKredit: rp(totalKredit),
    saldoAkhir: saldo,
  };
}

// ------------------------------------------------------------
// RINGKASAN KESEHATAN BISNIS (dashboard)
// ------------------------------------------------------------
function bulanWib(offset: number, acuan = new Date()) {
  const [y, m] = hariIniWib(acuan).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const akhir = new Date(Date.UTC(yy, d.getUTCMonth() + 1, 0)).getUTCDate();
  return { kunci: `${yy}-${mm}`, dari: `${yy}-${mm}-01`, sampai: `${yy}-${mm}-${String(akhir).padStart(2, '0')}` };
}

export async function ringkasan(entitas: Entitas, ex: Executor = db) {
  const hariIni = hariIniWib();
  const n = await neraca(entitas, hariIni, ex);
  const saldoAkun = (kode: string) =>
    [...n.aset, ...n.kewajiban].flatMap((g) => g.akun).find((a) => a.kode === kode)?.saldo ?? 0;
  const kasBank = rp(['1-1100', '1-1200', '1-1300'].reduce((s, k) => s + saldoAkun(k), 0));
  const persediaan = rp(saldoAkun('1-1500') + saldoAkun('1-1510'));
  const asetLancar = n.aset.find((g) => g.nama === 'Aset Lancar')?.total ?? 0;
  const kewajibanLancar = n.kewajiban.find((g) => g.nama === 'Kewajiban Lancar')?.total ?? 0;

  const ini = bulanWib(0);
  const lalu = bulanWib(-1);
  const periode = async (b: { dari: string; sampai: string }) => {
    const lr = await labaRugi(entitas, b.dari, b.sampai, ex);
    const ak = await arusKas(entitas, b.dari, b.sampai, ex);
    return {
      pendapatanBersih: lr.pendapatanBersih,
      labaKotor: lr.labaKotor,
      bebanOperasional: lr.totalBebanOperasional,
      labaBersih: lr.labaBersih,
      marginKotor: lr.marginKotor,
      marginBersih: lr.marginBersih,
      arusKasOperasi: ak.operasi.total,
    };
  };
  const bulanIni = await periode(ini);
  const bulanLalu = await periode(lalu);

  const rasio = {
    lancar: kewajibanLancar > 0 ? Math.round((asetLancar / kewajibanLancar) * 100) / 100 : null,
    cepat: kewajibanLancar > 0 ? Math.round(((asetLancar - persediaan) / kewajibanLancar) * 100) / 100 : null,
    der: n.totalEkuitas > 0 ? Math.round((n.totalKewajiban / n.totalEkuitas) * 100) / 100 : null,
  };

  const [pt] = (await ex.execute(sql`
    SELECT COUNT(*)::int AS jumlah, COALESCE(SUM(sisa_piutang), 0)::float8 AS total
    FROM faktur_penjualan WHERE divisi = ${entitas} AND sisa_piutang > 0 AND jatuh_tempo < now()
  `)) as unknown as { jumlah: number; total: number }[];
  const [ht] = (await ex.execute(sql`
    SELECT COUNT(*)::int AS jumlah, COALESCE(SUM(sisa_hutang), 0)::float8 AS total
    FROM hutang_supplier WHERE divisi = ${entitas} AND sisa_hutang > 0 AND lower(status) <> 'lunas'
      AND jatuh_tempo < now() + interval '7 days'
  `)) as unknown as { jumlah: number; total: number }[];
  const peringatan = {
    piutangLewatTempo: { jumlah: Number(pt?.jumlah) || 0, total: rp(Number(pt?.total) || 0) },
    hutangJatuhTempo7Hari: { jumlah: Number(ht?.jumlah) || 0, total: rp(Number(ht?.total) || 0) },
  };

  // Tren 6 bulan: pendapatan bersih, laba bersih, saldo kas akhir bulan
  const bulan = [-5, -4, -3, -2, -1, 0].map((o) => bulanWib(o));
  const awalTren = awalHariWib(bulan[0].dari);
  const mut = (await ex.execute(sql`
    SELECT to_char(j.tanggal + interval '7 hours', 'YYYY-MM') AS bln, a.tipe, a.kelompok, a.arus_kas,
           SUM(b.debit)::float8 AS d, SUM(b.kredit)::float8 AS k
    FROM jurnal j JOIN jurnal_baris b ON b.jurnal_id = j.id JOIN akun a ON a.kode = b.akun_kode
    WHERE j.entitas = ${entitas} AND j.tanggal >= ${ts(awalTren)}
    GROUP BY 1, 2, 3, 4
  `)) as unknown as { bln: string; tipe: string; kelompok: string; arus_kas: string | null; d: number; k: number }[];
  const kasAwalTren = (await saldoKas(ex, entitas, awalTren)).reduce((s, r) => s + r.saldo, 0);
  let kasBerjalan = kasAwalTren;
  const tren = bulan.map((b) => {
    const m = mut.filter((x) => x.bln === b.kunci);
    const sum = (f: (x: (typeof m)[number]) => boolean, s: (x: (typeof m)[number]) => number) =>
      m.filter(f).reduce((t, x) => t + s(x), 0);
    const pendapatan = sum((x) => x.kelompok === 'Pendapatan Usaha', (x) => x.k - x.d) - sum((x) => x.kelompok === 'Pengurang Pendapatan', (x) => x.d - x.k);
    const laba = sum((x) => x.tipe === 'PENDAPATAN', (x) => x.k - x.d) - sum((x) => x.tipe === 'BEBAN', (x) => x.d - x.k);
    kasBerjalan += sum((x) => x.arus_kas === 'KAS', (x) => x.d - x.k);
    return { bulan: b.kunci, pendapatan: rp(pendapatan), labaBersih: rp(laba), kasAkhir: rp(kasBerjalan) };
  });

  // Skor kesehatan sederhana & transparan (setiap potongan punya alasan)
  const catatan: string[] = [];
  let nilai = 100;
  const potong = (poin: number, alasan: string) => {
    nilai -= poin;
    catatan.push(alasan);
  };
  const adaData = mut.length > 0 || !nol(n.totalAset);
  if (!adaData) {
    return {
      entitas,
      posisi: { kasBank, piutang: saldoAkun('1-1400'), persediaan, asetLancar, totalAset: n.totalAset, hutangUsaha: saldoAkun('2-1100'), kewajibanLancar, totalKewajiban: n.totalKewajiban, ekuitas: n.totalEkuitas },
      bulanIni,
      bulanLalu,
      rasio,
      peringatan,
      tren,
      skor: { nilai: 0, label: 'Waspada' as const, catatan: ['Belum ada transaksi tercatat. Catat modal awal lewat Jurnal Manual.'] },
    };
  }
  if (kasBank <= 0) potong(20, 'Saldo kas & bank habis atau minus');
  if (bulanIni.labaBersih < 0) potong(25, 'Bulan ini rugi');
  if (bulanIni.arusKasOperasi < 0) potong(15, 'Arus kas operasi bulan ini negatif');
  if (rasio.lancar !== null && rasio.lancar < 1) potong(25, 'Rasio lancar di bawah 1: aset lancar tidak cukup menutup kewajiban lancar');
  else if (rasio.lancar !== null && rasio.lancar < 1.5) potong(10, 'Rasio lancar di bawah 1,5');
  if (rasio.der === null && n.totalKewajiban > 0) potong(20, 'Ekuitas habis atau negatif');
  else if (rasio.der !== null && rasio.der > 2) potong(20, 'Hutang lebih dari 2x ekuitas');
  else if (rasio.der !== null && rasio.der > 1) potong(10, 'Hutang lebih besar dari ekuitas');
  if (peringatan.piutangLewatTempo.jumlah > 0) potong(10, `${peringatan.piutangLewatTempo.jumlah} piutang lewat jatuh tempo`);
  if (peringatan.hutangJatuhTempo7Hari.total > kasBank) potong(15, 'Hutang jatuh tempo 7 hari melebihi kas & bank');
  nilai = Math.max(0, nilai);
  if (!catatan.length) catatan.push('Semua indikator utama dalam batas sehat');

  return {
    entitas,
    posisi: {
      kasBank,
      piutang: saldoAkun('1-1400'),
      persediaan,
      asetLancar,
      totalAset: n.totalAset,
      hutangUsaha: saldoAkun('2-1100'),
      kewajibanLancar,
      totalKewajiban: n.totalKewajiban,
      ekuitas: n.totalEkuitas,
    },
    bulanIni,
    bulanLalu,
    rasio,
    peringatan,
    tren,
    skor: { nilai, label: (nilai >= 75 ? 'Sehat' : nilai >= 50 ? 'Waspada' : 'Kritis') as 'Sehat' | 'Waspada' | 'Kritis', catatan },
  };
}
