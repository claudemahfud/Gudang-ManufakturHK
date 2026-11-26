import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { requireAuthRole, ROLES_FINANCE, ROLES_FINANCE_SETORAN, ROLES_PEMBUKUAN, ROLES_SALES_SETORAN, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { saldoSales } from '@/shared/lib/setoran';
import { daftarTransferSales } from '@/shared/lib/verifikasi-transfer';
import { punyaRole } from '@/shared/lib/auth/roles';
import { PO_STATUS } from '@/shared/lib/po-status';
import { ROUTES } from '@/router/routes';

// ============================================================
// API: Notifikasi lonceng header
// GET /api/notifikasi?divisi=MANUFAKTUR|FNB
// Dihitung langsung dari data (tanpa tabel antrean): stok kritis, PO menunggu,
// piutang & hutang jatuh tempo, pengajuan diskon menunggu. Isi mengikuti role.
// ============================================================

type Notif = {
  id: string; // kunci stabil: berubah bila isinya berubah, dipakai penanda "sudah dilihat"
  tipe: 'warning' | 'error' | 'info';
  judul: string;
  pesan: string;
  href: string;
  waktu: string | null;
};

type Baris = Record<string, unknown>;
const rp = (n: unknown) => `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;

export async function GET(req: NextRequest) {
  const auth = await requireAuthRole();
  if (!auth.authorized) return auth.response;
  const user = auth.user;

  const divisi = new URL(req.url).searchParams.get('divisi') === 'FNB' ? 'FNB' : 'MANUFAKTUR';
  const daftar: Notif[] = [];

  try {
    if (punyaRole(user, ROLES_WAREHOUSE)) {
      const [k] = (await db.execute(sql`
        SELECT COUNT(*)::int AS n,
               COUNT(*) FILTER (WHERE stok <= 0)::int AS habis,
               string_agg(nama_barang, ', ' ORDER BY stok) FILTER (WHERE rn <= 3) AS contoh
        FROM (SELECT nama_barang, stok, ROW_NUMBER() OVER (ORDER BY stok) AS rn
              FROM inventory
              WHERE divisi = ${divisi} AND stok <= COALESCE(stok_minimum, 10)) t
      `)) as unknown as Baris[];
      const n = Number(k?.n) || 0;
      if (n > 0) {
        daftar.push({
          id: `stok:${n}:${k.habis}`,
          tipe: Number(k.habis) > 0 ? 'error' : 'warning',
          judul: `${n} barang stok kritis`,
          pesan: `${Number(k.habis) > 0 ? `${k.habis} habis. ` : ''}${k.contoh ?? ''}`,
          href: ROUTES.STOK_KRITIS,
          waktu: null,
        });
      }

      const [po] = (await db.execute(sql`
        SELECT COUNT(*)::int AS n, MIN(tanggal) AS tertua
        FROM po_loading WHERE status IN (${PO_STATUS.PROSES}, ${PO_STATUS.SEBAGIAN})
      `)) as unknown as Baris[];
      if (Number(po?.n) > 0) {
        daftar.push({
          id: `po:${po.n}`,
          tipe: 'info',
          judul: `${po.n} PO menunggu barang datang`,
          pesan: 'Terima barang lewat Barang Masuk saat armada tiba.',
          href: ROUTES.PO_LOADING,
          waktu: po.tertua ? new Date(String(po.tertua)).toISOString() : null,
        });
      }
    }

    if (punyaRole(user, ROLES_FINANCE)) {
      const [pt] = (await db.execute(sql`
        SELECT COUNT(*)::int AS n,
               COUNT(*) FILTER (WHERE jatuh_tempo < now())::int AS lewat,
               COALESCE(SUM(sisa_piutang), 0) AS total
        FROM faktur_penjualan
        WHERE divisi = ${divisi} AND sisa_piutang > 0
          AND jatuh_tempo IS NOT NULL AND jatuh_tempo < now() + interval '3 days'
      `)) as unknown as Baris[];
      if (Number(pt?.n) > 0) {
        daftar.push({
          id: `piutang:${pt.n}:${pt.lewat}:${pt.total}`,
          tipe: Number(pt.lewat) > 0 ? 'error' : 'warning',
          judul: `${pt.n} piutang jatuh tempo`,
          pesan: `${Number(pt.lewat) > 0 ? `${pt.lewat} sudah lewat tempo. ` : ''}Total ${rp(pt.total)}`,
          href: ROUTES.PIUTANG,
          waktu: null,
        });
      }
    }

    // Hutang suplier dikelola pembukuan (Direktur Utama & Manager)
    if (punyaRole(user, ROLES_PEMBUKUAN)) {
      const [ht] = (await db.execute(sql`
        SELECT COUNT(*)::int AS n,
               COUNT(*) FILTER (WHERE jatuh_tempo < now())::int AS lewat,
               COALESCE(SUM(sisa_hutang), 0) AS total
        FROM hutang_supplier
        WHERE divisi = ${divisi} AND sisa_hutang > 0 AND lower(status) <> 'lunas'
          AND jatuh_tempo IS NOT NULL AND jatuh_tempo < now() + interval '3 days'
      `)) as unknown as Baris[];
      if (Number(ht?.n) > 0) {
        daftar.push({
          id: `hutang:${ht.n}:${ht.lewat}:${ht.total}`,
          tipe: Number(ht.lewat) > 0 ? 'error' : 'warning',
          judul: `${ht.n} hutang suplier jatuh tempo`,
          pesan: `${Number(ht.lewat) > 0 ? `${ht.lewat} sudah lewat tempo. ` : ''}Total ${rp(ht.total)}`,
          href: '/hutang',
          waktu: null,
        });
      }
    }

    // Setoran sales: Finance melihat yang menunggu konfirmasi; sales melihat kas yang belum disetor
    if (punyaRole(user, ROLES_FINANCE_SETORAN)) {
      const [st] = (await db.execute(sql`
        SELECT COUNT(*)::int AS n, COALESCE(SUM(jumlah), 0) AS total, MAX(created_at) AS terbaru
        FROM setoran_sales WHERE status = 'menunggu' AND divisi = ${divisi}
      `)) as unknown as Baris[];
      if (Number(st?.n) > 0) {
        daftar.push({
          id: `setoran:${st.n}:${st.total}`,
          tipe: 'warning',
          judul: `${st.n} setoran sales menunggu konfirmasi`,
          pesan: `Total ${rp(st.total)}. Cek uangnya lalu konfirmasi.`,
          href: '/setoran',
          waktu: st.terbaru ? new Date(String(st.terbaru)).toISOString() : null,
        });
      }
    }
    if (punyaRole(user, ROLES_FINANCE_SETORAN)) {
      const lama = (await daftarTransferSales(db, divisi)).filter((t) => t.umurHari >= 1);
      if (lama.length > 0) {
        const total = lama.reduce((s, t) => s + t.jumlah, 0);
        daftar.push({
          id: `verif:${lama.length}:${total}`,
          tipe: 'warning',
          judul: `${lama.length} transfer sales belum dicek > 1 hari`,
          pesan: `Total ${rp(total)}. Cocokkan dengan mutasi rekening.`,
          href: '/setoran',
          waktu: null,
        });
      }
    }
    if (punyaRole(user, ROLES_SALES_SETORAN) && user?.username) {
      const [s] = await saldoSales(db, divisi, String(user.username));
      if (s && s.tersedia > 0) {
        daftar.push({
          id: `kassales:${Math.round(s.tersedia)}`,
          tipe: 'info',
          judul: 'Kas belum disetor ke Finance',
          pesan: `Rp ${Math.round(s.tersedia).toLocaleString('id-ID')} masih di tangan Anda. Setor lewat menu Setoran ke Finance.`,
          href: '/setoran',
          waktu: null,
        });
      }
    }

    if (punyaRole(user, ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum', 'Admin Salesman'])) {
      const [dk] = (await db.execute(sql`
        SELECT COUNT(*)::int AS n, MAX(created_at) AS terbaru
        FROM diskon_request WHERE status = 'pending'
      `)) as unknown as Baris[];
      if (Number(dk?.n) > 0) {
        daftar.push({
          id: `diskon:${dk.n}:${dk.terbaru}`,
          tipe: 'info',
          judul: `${dk.n} pengajuan diskon menunggu`,
          pesan: 'Setujui atau tolak pengajuan dari salesman.',
          href: ROUTES.PENGAJUAN_DISKON,
          waktu: dk.terbaru ? new Date(String(dk.terbaru)).toISOString() : null,
        });
      }
    }

    return NextResponse.json({ success: true, data: daftar });
  } catch (error) {
    console.error('Error GET /api/notifikasi:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat notifikasi' }, { status: 500 });
  }
}
