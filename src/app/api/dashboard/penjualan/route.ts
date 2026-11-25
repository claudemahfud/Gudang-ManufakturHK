import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { canViewCostPrice, requireAuthRole, ROLES_PANEL_PENJUALAN } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';
import { entitasDari } from '@/shared/lib/jurnal';
import { akhirHariWib, awalHariWib, hariIniWib, labaRugi, tanggalQuery, tsWib } from '@/shared/lib/laporan-keuangan';

// ============================================================
// GET /api/dashboard/penjualan?divisi=&mode=harian|mingguan|bulan&tgl=YYYY-MM-DD
// Ringkasan penjualan per periode untuk panel Dashboard (pimpinan, finance, sales).
// Laba kotor & margin HANYA dikirim ke role yang boleh melihat HPP/laba (canViewCostPrice):
// sales menerima angka penjualan saja.
// ============================================================

const MODE = ['harian', 'mingguan', 'bulan'] as const;
type Mode = (typeof MODE)[number];

const tambahHari = (tgl: string, n: number) => new Date(Date.UTC(+tgl.slice(0, 4), +tgl.slice(5, 7) - 1, +tgl.slice(8, 10) + n)).toISOString().slice(0, 10);

/** Rentang periode (tanggal WIB, inklusif) dari mode + tanggal acuan. */
function rentangPeriode(mode: Mode, tgl: string) {
  if (mode === 'harian') return { dari: tgl, sampai: tgl };
  if (mode === 'mingguan') {
    const d = new Date(`${tgl}T00:00:00Z`);
    const dari = tambahHari(tgl, -((d.getUTCDay() + 6) % 7)); // Senin
    return { dari, sampai: tambahHari(dari, 6) };
  }
  const [y, m] = tgl.split('-').map(Number);
  const akhir = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { dari: `${y}-${mm}-01`, sampai: `${y}-${mm}-${String(akhir).padStart(2, '0')}` };
}

async function jumlahPenjualan(divisi: string, dari: string, sampai: string) {
  const a = tsWib(awalHariWib(dari));
  const b = tsWib(akhirHariWib(sampai));
  const [pos] = (await db.execute(sql`
    SELECT COALESCE(SUM(total), 0)::float8 AS total, COUNT(DISTINCT trx_id)::int AS trx, COALESCE(SUM(qty), 0)::float8 AS qty
    FROM barang_keluar WHERE divisi = ${divisi} AND channel = 'POS' AND tanggal >= ${a} AND tanggal < ${b}
  `)) as unknown as { total: number; trx: number; qty: number }[];
  const [fak] = (await db.execute(sql`
    SELECT COALESCE(SUM(grand_total), 0)::float8 AS total, COALESCE(SUM(sisa_piutang), 0)::float8 AS belum, COUNT(*)::int AS trx
    FROM faktur_penjualan WHERE divisi = ${divisi} AND tanggal >= ${a} AND tanggal < ${b}
  `)) as unknown as { total: number; belum: number; trx: number }[];
  const [qtyFak] = (await db.execute(sql`
    SELECT COALESCE(SUM(qty), 0)::float8 AS qty FROM barang_keluar
    WHERE divisi = ${divisi} AND channel = 'GROSIR' AND tanggal >= ${a} AND tanggal < ${b}
  `)) as unknown as { qty: number }[];
  return {
    total: Number(pos?.total || 0) + Number(fak?.total || 0),
    belum: Number(fak?.belum || 0),
    transaksi: Number(pos?.trx || 0) + Number(fak?.trx || 0),
    produk: Number(pos?.qty || 0) + Number(qtyFak?.qty || 0),
  };
}

const rp = (n: number) => Math.round(n * 100) / 100;

export async function GET(req: Request) {
  try {
    const auth = await requireAuthRole(ROLES_PANEL_PENJUALAN);
    if (!auth.authorized) return auth.response;
    const q = new URL(req.url).searchParams;
    const divisi = entitasDari(q.get('divisi'));
    const mode = (MODE as readonly string[]).includes(q.get('mode') ?? '') ? (q.get('mode') as Mode) : 'harian';
    const hari = hariIniWib();
    const tgl = tanggalQuery(q.get('tgl'), hari);
    const { dari, sampai } = rentangPeriode(mode, tgl);

    const p = await jumlahPenjualan(divisi, dari, sampai);

    // Akumulasi dari awal bulan (bulan dari akhir periode) & proyeksi bulan berjalan
    const awalBulan = `${sampai.slice(0, 8)}01`;
    const akum = mode === 'bulan' ? p : await jumlahPenjualan(divisi, awalBulan, sampai);
    const bulanIni = sampai.slice(0, 7) === hari.slice(0, 7);
    const hariBulan = new Date(Date.UTC(+sampai.slice(0, 4), +sampai.slice(5, 7), 0)).getUTCDate();
    const hariBerjalan = bulanIni ? Number(hari.slice(8, 10)) : 0;
    const proyeksi = bulanIni && hariBerjalan > 0 ? rp((akum.total / hariBerjalan) * hariBulan) : null;

    const data: Record<string, unknown> = {
      mode,
      dari,
      sampai,
      total: rp(p.total),
      belumDibayar: rp(p.belum),
      terbayar: rp(Math.max(0, p.total - p.belum)),
      transaksi: p.transaksi,
      perTransaksi: p.transaksi > 0 ? rp(p.total / p.transaksi) : 0,
      produkTerjual: p.produk,
      produkPerTransaksi: p.transaksi > 0 ? Math.round((p.produk / p.transaksi) * 10) / 10 : 0,
      akumulasi: rp(akum.total),
      proyeksi,
      tampilLaba: false,
    };

    // Laba/margin: hanya role yang boleh melihat HPP (sales tidak menerima field ini sama sekali)
    if (canViewCostPrice(auth.user)) {
      const lr = await labaRugi(divisi, dari, sampai);
      data.tampilLaba = true;
      data.labaKotor = lr.labaKotor;
      data.marginKotor = lr.marginKotor;
    }
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err, 'DASHBOARD_PENJUALAN');
  }
}
