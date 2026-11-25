import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { akun, jurnal, jurnalBaris, masterCabang, users } from '@/shared/lib/db/schema';
import { BusinessError } from '@/shared/lib/stock';
import { nomorUrut } from '@/shared/lib/nomor-urut';

// ============================================================
// Jurnal akuntansi berpasangan (double-entry). Wajib dipanggil di dalam db.transaction
// bersama transaksi asalnya, sehingga buku besar selalu sama dengan transaksi operasional.
// - Entitas MANUFAKTUR & FNB adalah dua perusahaan terpisah (diambil dari divisi).
// - Transaksi di cabang FRANCHISE milik pewaralaba, bukan buku perusahaan: tidak dijurnal.
// - Jurnal tidak diubah/dihapus; pembatalan = jurnal pembalik (balikJurnal).
// ============================================================

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

export type Entitas = 'MANUFAKTUR' | 'FNB';

/** Kode akun yang dipakai jurnal otomatis (lihat migrasi 012). */
export const AKUN = {
  KAS_TUNAI: '1-1100',
  BANK: '1-1200',
  KAS_QRIS: '1-1300',
  KAS_SALES: '1-1350',
  PIUTANG: '1-1400',
  PERSEDIAAN: '1-1500',
  HUTANG_USAHA: '2-1100',
  PPN_KELUARAN: '2-1200',
  MODAL: '3-1000',
  PENJUALAN_POS: '4-1100',
  PENJUALAN_FAKTUR: '4-1200',
  PENJUALAN_FRANCHISE: '4-1300',
  PENDAPATAN_ONGKIR: '4-1400',
  RETUR_PENJUALAN: '4-2100',
  POTONGAN_PENJUALAN: '4-2200',
  HPP: '5-1100',
  SELISIH_PERSEDIAAN: '5-1200',
  KERUGIAN_RUSAK: '5-1300',
  OVERHEAD_DIBEBANKAN: '5-1400',
  SELISIH_KAS: '6-2100',
} as const;

export const AKUN_KAS: readonly string[] = [AKUN.KAS_TUNAI, AKUN.BANK, AKUN.KAS_QRIS];

export const LABEL_SUMBER: Record<string, string> = {
  POS: 'Penjualan Kasir',
  BATAL_POS: 'Batal Item Kasir',
  FAKTUR: 'Faktur Penjualan',
  BAYAR_PIUTANG: 'Pembayaran Piutang',
  RETUR: 'Retur Pelanggan',
  PEMBELIAN: 'Pembelian',
  BATAL_PEMBELIAN: 'Batal Pembelian',
  BAYAR_HUTANG: 'Pembayaran Hutang',
  BIAYA: 'Biaya Operasional',
  KAS_MANUAL: 'Kas Manual',
  SETORAN: 'Setoran Sales',
  RUSAK: 'Barang Rusak',
  PRODUKSI: 'Produksi Dapur',
  REVALUASI: 'Revaluasi HPP',
  KAS_OPNAME: 'Selisih Kas Opname',
  MANUAL: 'Jurnal Manual',
  PEMBALIK: 'Jurnal Pembalik',
};

export function entitasDari(divisi: string | null | undefined): Entitas {
  return divisi === 'FNB' ? 'FNB' : 'MANUFAKTUR';
}

/** Akun kas sesuai metode bayar (tunai/transfer/qris; tempo dengan uang muka = tunai). */
export function akunKas(metode: string | null | undefined): string {
  const m = String(metode || '').toLowerCase();
  if (m === 'transfer' || m.startsWith('transfer') || m === 'debit' || m === 'bank') return AKUN.BANK;
  if (m === 'qris' || m === 'e-wallet' || m === 'ewallet') return AKUN.KAS_QRIS;
  return AKUN.KAS_TUNAI;
}

const rp = (n: number) => Math.round(n * 100) / 100;

/** Role sales: uang TUNAI yang mereka terima dicatat di Kas di Tangan Sales sampai disetor ke Finance. */
export const ROLE_SALES: readonly string[] = [
  'Salesman', 'Sales Canvas', 'Sales Motoris', 'Admin Salesman', 'Staff Admin Salesman',
  'Agen', 'Sales Agent', 'Admin Agen', 'Staff Admin Agen',
];

/**
 * Akun penerima uang untuk sebuah transaksi. Tunai yang diterima akun ber-role utama sales masuk
 * 1-1350 (dengan username sales); transfer/QRIS selalu langsung ke Bank/QRIS perusahaan.
 */
export async function penerimaKas(ex: Executor, username: string | null | undefined, metode: string | null | undefined) {
  const akunDasar = akunKas(metode);
  if (!username || akunDasar !== AKUN.KAS_TUNAI) return { akun: akunDasar, sales: undefined as string | undefined };
  const [u] = await ex.select({ role: users.role }).from(users).where(eq(users.username, username)).limit(1);
  return u && ROLE_SALES.includes(u.role)
    ? { akun: AKUN.KAS_SALES as string, sales: username as string | undefined }
    : { akun: akunDasar, sales: undefined as string | undefined };
}

export interface BarisJurnal {
  akun: string;
  debit?: number;
  kredit?: number;
  keterangan?: string | null;
  /** Hanya untuk akun 1-1350: username sales pemegang kas. */
  sales?: string | null;
}

export interface JurnalInput {
  tanggal: Date;
  divisi: string; // MANUFAKTUR | FNB
  cabang: string;
  sumber: string;
  referensi: string | null;
  keterangan: string;
  user: string | null;
  baris: BarisJurnal[];
  /** Jurnal manual: abaikan pengecualian cabang franchise & simpan baris apa adanya. */
  manual?: boolean;
  pembalikDari?: string | null;
}

/** Cabang franchise = usaha pewaralaba, bukan buku perusahaan. */
export async function cabangFranchise(ex: Executor, cabang: string) {
  const [c] = await ex
    .select({ tipe: masterCabang.tipe })
    .from(masterCabang)
    .where(eq(masterCabang.namaCabang, cabang))
    .limit(1);
  return c?.tipe === 'FRANCHISE';
}

/**
 * Bersihkan baris: jumlah dibulatkan 2 desimal, akun sama digabung jadi saldo bersih
 * (mis. persediaan masuk & keluar dalam satu jurnal produksi), baris nol dibuang.
 * Jurnal manual tidak digabung (keterangan per baris dipertahankan).
 */
function rapikan(baris: BarisJurnal[], gabung: boolean) {
  const bersih = baris
    .map((b) => ({ akun: b.akun, debit: rp(Math.max(0, b.debit || 0)), kredit: rp(Math.max(0, b.kredit || 0)), keterangan: b.keterangan ?? null, sales: b.sales ?? null }))
    .filter((b) => b.debit > 0 || b.kredit > 0);
  if (!gabung) {
    return bersih.map((b) => {
      const net = rp(b.debit - b.kredit);
      return { ...b, debit: net > 0 ? net : 0, kredit: net < 0 ? -net : 0 };
    }).filter((b) => b.debit > 0 || b.kredit > 0);
  }
  // Digabung per akun (+ sales, agar saldo tiap sales terpisah)
  const per = new Map<string, { akun: string; sales: string | null; net: number }>();
  for (const b of bersih) {
    const kunci = `${b.akun}|${b.sales ?? ''}`;
    const cur = per.get(kunci) ?? { akun: b.akun, sales: b.sales, net: 0 };
    cur.net = rp(cur.net + b.debit - b.kredit);
    per.set(kunci, cur);
  }
  return [...per.values()]
    .filter((x) => Math.abs(x.net) >= 0.01)
    .map((x) => ({ akun: x.akun, debit: x.net > 0 ? x.net : 0, kredit: x.net < 0 ? rp(-x.net) : 0, keterangan: null, sales: x.sales }));
}

/**
 * Catat satu jurnal seimbang. Return id jurnal, atau null bila tidak ada yang perlu dijurnal
 * (semua baris nol / cabang franchise). Tidak seimbang = kesalahan program: dilempar.
 */
export async function posting(tx: Tx, j: JurnalInput): Promise<string | null> {
  if (!j.manual && (await cabangFranchise(tx, j.cabang))) return null;

  const baris = rapikan(j.baris, !j.manual);
  if (baris.length === 0) return null;
  const d = rp(baris.reduce((s, b) => s + b.debit, 0));
  const k = rp(baris.reduce((s, b) => s + b.kredit, 0));
  if (Math.abs(d - k) >= 0.01) {
    throw new Error(`Jurnal ${j.sumber} ${j.referensi ?? ''} tidak seimbang: debit ${d} kredit ${k}`);
  }
  if (baris.length < 2) return null; // debit & kredit di akun yang sama: tidak ada mutasi

  const noJurnal = await nomorUrut(tx, 'JRN', j.tanggal);
  const [h] = await tx
    .insert(jurnal)
    .values({
      noJurnal,
      tanggal: j.tanggal,
      entitas: entitasDari(j.divisi),
      cabang: j.cabang || 'Pusat',
      sumber: j.sumber,
      referensi: j.referensi,
      keterangan: j.keterangan.slice(0, 2000),
      pembalikDari: j.pembalikDari ?? null,
      dibuatOleh: j.user,
    })
    .returning({ id: jurnal.id });
  await tx.insert(jurnalBaris).values(
    baris.map((b) => ({
      jurnalId: h.id,
      akunKode: b.akun,
      debit: String(b.debit),
      kredit: String(b.kredit),
      keterangan: b.keterangan,
      sales: b.sales,
    }))
  );
  return h.id;
}

/** Jurnal aktif (belum dibalik, bukan pembalik) untuk referensi & sumber tertentu. */
async function jurnalAktif(tx: Tx, referensi: string, sumber: readonly string[]) {
  return tx
    .select()
    .from(jurnal)
    .where(
      and(
        eq(jurnal.referensi, referensi),
        inArray(jurnal.sumber, [...sumber]),
        isNull(jurnal.pembalikDari),
        sql`NOT EXISTS (SELECT 1 FROM jurnal p WHERE p.pembalik_dari = ${jurnal.id})`
      )
    )
    .for('update');
}

/** Balik satu jurnal: debit <-> kredit, sumber PEMBALIK, referensi sama. */
export async function balikSatuJurnal(tx: Tx, id: string, keterangan: string, user: string | null, tanggal = new Date()) {
  const [h] = await tx.select().from(jurnal).where(eq(jurnal.id, id)).for('update').limit(1);
  if (!h) throw new BusinessError('Jurnal tidak ditemukan', 404);
  if (h.pembalikDari) throw new BusinessError('Jurnal pembalik tidak bisa dibalik lagi');
  const [sudah] = await tx.select({ id: jurnal.id }).from(jurnal).where(eq(jurnal.pembalikDari, id)).limit(1);
  if (sudah) throw new BusinessError(`Jurnal ${h.noJurnal} sudah dibatalkan`);

  const baris = await tx.select().from(jurnalBaris).where(eq(jurnalBaris.jurnalId, id));
  return posting(tx, {
    tanggal,
    divisi: h.entitas,
    cabang: h.cabang,
    sumber: 'PEMBALIK',
    referensi: h.referensi,
    keterangan: `Pembalik ${h.noJurnal}: ${keterangan}`,
    user,
    manual: true, // salin apa adanya, termasuk cabang franchise (tidak pernah terjadi) & keterangan baris
    pembalikDari: id,
    baris: baris.map((b) => ({ akun: b.akunKode, debit: Number(b.kredit), kredit: Number(b.debit), keterangan: b.keterangan, sales: b.sales })),
  });
}

/**
 * Batalkan semua jurnal aktif sebuah dokumen (mis. faktur dibatalkan: jurnal faktur & pembayarannya).
 * Return jumlah jurnal yang dibalik.
 */
export async function balikJurnal(
  tx: Tx,
  p: { referensi: string; sumber: readonly string[]; keterangan: string; user: string | null; tanggal?: Date }
) {
  const aktif = await jurnalAktif(tx, p.referensi, p.sumber);
  for (const h of aktif) await balikSatuJurnal(tx, h.id, p.keterangan, p.user, p.tanggal);
  return aktif.length;
}

/** Baris jurnal aktif sebuah dokumen (dipakai pembatalan sebagian, mis. satu item POS). */
export async function barisJurnalAktif(tx: Tx, referensi: string, sumber: readonly string[]) {
  const aktif = await jurnalAktif(tx, referensi, sumber);
  if (!aktif.length) return [];
  return tx.select().from(jurnalBaris).where(inArray(jurnalBaris.jurnalId, aktif.map((h) => h.id)));
}

/** Validasi akun untuk input manual: ada, aktif, dan akun posting. */
export async function wajibAkunPosting(ex: Executor, kode: string) {
  const [a] = await ex.select().from(akun).where(eq(akun.kode, kode)).limit(1);
  if (!a || !a.aktif || !a.posting) throw new BusinessError(`Akun ${kode || '(kosong)'} tidak valid atau bukan akun posting`);
  return a;
}
