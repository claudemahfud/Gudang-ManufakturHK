import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { requireAuthRole, ROLES_PROFIT_MARGIN } from '@/shared/lib/auth/rbac';
import { roleUtamaDi } from '@/shared/lib/auth/roles';

// ============================================================
// API: /api/laporan/rekap?dari=YYYY-MM-DD&sampai=YYYY-MM-DD&divisi=&cabang=
// Rekap penjualan global untuk Dashboard: total + rincian per hari, produk,
// salesman/kasir, jalur, metode bayar, pelanggan. Tanggal = kalender WIB.
// Sumber & rumus sama dengan Laporan Penjualan (barang_keluar, HPP = harga beli
// master x qty), tetapi dihitung atas seluruh periode, tanpa batas jumlah baris.
// ============================================================

type Baris = {
  trx_id: string;
  tgl: string;
  sku: string;
  nama_barang: string;
  qty: number;
  harga_jual: string | null;
  total: string | null;
  diskon: string | null;
  pelanggan: string | null;
  salesman: string | null;
  channel: string;
  keterangan: string | null;
  hb: string | null;
  metode_faktur: string | null;
};

type Agregat = { kunci: string; label: string; qty: number; omzet: number; hpp: number; trx: Set<string> };

const POLA_TGL = /^\d{4}-\d{2}-\d{2}$/;
const JALUR: Record<string, string> = { POS: 'Kasir POS', GROSIR: 'Faktur Penjualan', INTERNAL: 'Internal' };
const METODE: Record<string, string> = { tunai: 'Tunai', transfer: 'Transfer', tempo: 'Tempo / Kredit', qris: 'QRIS' };

function hariIniWib() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_PROFIT_MARGIN);
    if (!authResult.authorized) return authResult.response;

    const p = new URL(req.url).searchParams;
    const hari = hariIniWib();
    const dari = POLA_TGL.test(p.get('dari') || '') ? (p.get('dari') as string) : hari;
    const sampai = POLA_TGL.test(p.get('sampai') || '') ? (p.get('sampai') as string) : hari;
    if (dari > sampai) {
      return NextResponse.json({ success: false, message: 'Tanggal awal melewati tanggal akhir' }, { status: 400 });
    }
    const divisi = p.get('divisi');

    // Isolasi cabang sama seperti Laporan Penjualan
    const u = authResult.user as { cabang?: string } | null;
    const userCabang = u?.cabang || 'Pusat';
    const eksekutif = roleUtamaDi(authResult.user, ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum', 'Finance & Accounting']);
    let cabang: string | null = null;
    if (!eksekutif && userCabang !== 'ALL' && userCabang !== 'Pusat') cabang = userCabang;
    else if (p.get('cabang') && p.get('cabang') !== 'SEMUA') cabang = p.get('cabang');

    const hasil = await db.execute(sql`
      SELECT bk.trx_id,
             to_char(bk.tanggal AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS tgl,
             bk.sku, bk.nama_barang, bk.qty, bk.harga_jual, bk.total, bk.diskon,
             bk.pelanggan, bk.salesman, bk.channel, bk.keterangan,
             inv.harga_beli AS hb, fp.metode_bayar AS metode_faktur
      FROM barang_keluar bk
      LEFT JOIN inventory inv ON inv.sku = bk.sku
      LEFT JOIN faktur_penjualan fp ON fp.no_faktur = bk.trx_id
      WHERE bk.tanggal >= (${dari}::date)::timestamp AT TIME ZONE 'Asia/Jakarta' AT TIME ZONE 'UTC'
        AND bk.tanggal <  ((${sampai}::date + 1))::timestamp AT TIME ZONE 'Asia/Jakarta' AT TIME ZONE 'UTC'
        ${divisi && divisi !== 'SEMUA' ? sql`AND bk.divisi = ${divisi}` : sql``}
        ${cabang ? sql`AND bk.cabang = ${cabang}` : sql``}
    `);
    const rows = hasil as unknown as Baris[];

    const grup = {
      hari: new Map<string, Agregat>(),
      produk: new Map<string, Agregat>(),
      sales: new Map<string, Agregat>(),
      jalur: new Map<string, Agregat>(),
      metode: new Map<string, Agregat>(),
      pelanggan: new Map<string, Agregat>(),
    };
    const tambah = (m: Map<string, Agregat>, kunci: string, label: string, trx: string, qty: number, omzet: number, hpp: number) => {
      let a = m.get(kunci);
      if (!a) m.set(kunci, (a = { kunci, label, qty: 0, omzet: 0, hpp: 0, trx: new Set() }));
      a.qty += qty;
      a.omzet += omzet;
      a.hpp += hpp;
      a.trx.add(trx);
    };

    let omzet = 0;
    let hpp = 0;
    let qtyTotal = 0;
    let diskon = 0;
    const semuaTrx = new Set<string>();
    for (const r of rows) {
      const qty = Number(r.qty) || 0;
      const hj = Number(r.harga_jual) || 0;
      const netto = r.total != null ? Number(r.total) : hj * qty;
      const h = (Number(r.hb) || 0) * qty;
      omzet += netto;
      hpp += h;
      qtyTotal += qty;
      diskon += (hj * qty * (Number(r.diskon) || 0)) / 100;
      semuaTrx.add(r.trx_id);

      const metodeKunci =
        r.channel === 'POS'
          ? (r.keterangan?.match(/POS Checkout \(([^)]+)\)/)?.[1] || 'Lainnya').toLowerCase()
          : (r.metode_faktur || 'lainnya').toLowerCase();
      tambah(grup.hari, r.tgl, r.tgl, r.trx_id, qty, netto, h);
      tambah(grup.produk, r.sku, r.nama_barang, r.trx_id, qty, netto, h);
      tambah(grup.sales, r.salesman || '-', r.salesman || 'Tanpa nama', r.trx_id, qty, netto, h);
      tambah(grup.jalur, r.channel, JALUR[r.channel] || r.channel, r.trx_id, qty, netto, h);
      tambah(grup.metode, metodeKunci, METODE[metodeKunci] || metodeKunci.replace(/^\w/, (c) => c.toUpperCase()), r.trx_id, qty, netto, h);
      tambah(grup.pelanggan, r.pelanggan || '-', r.pelanggan || 'Umum', r.trx_id, qty, netto, h);
    }

    const bulat = (n: number) => Math.round(n * 100) / 100;
    const keluar = (m: Map<string, Agregat>, urut: 'omzet' | 'kunci', batas?: number) => {
      const arr = [...m.values()].map((a) => ({
        kunci: a.kunci,
        label: a.label,
        qty: a.qty,
        trx: a.trx.size,
        omzet: bulat(a.omzet),
        hpp: bulat(a.hpp),
        laba: bulat(a.omzet - a.hpp),
        margin: a.omzet > 0 ? bulat(((a.omzet - a.hpp) / a.omzet) * 100) : 0,
        persen: omzet > 0 ? bulat((a.omzet / omzet) * 100) : 0,
      }));
      arr.sort((x, y) => (urut === 'kunci' ? x.kunci.localeCompare(y.kunci) : y.omzet - x.omzet));
      return batas ? arr.slice(0, batas) : arr;
    };

    return NextResponse.json({
      success: true,
      periode: { dari, sampai },
      total: {
        omzet: bulat(omzet),
        hpp: bulat(hpp),
        laba: bulat(omzet - hpp),
        margin: omzet > 0 ? bulat(((omzet - hpp) / omzet) * 100) : 0,
        qty: qtyTotal,
        trx: semuaTrx.size,
        diskon: bulat(diskon),
      },
      perHari: keluar(grup.hari, 'kunci'),
      perProduk: keluar(grup.produk, 'omzet', 10),
      perSales: keluar(grup.sales, 'omzet', 10),
      perJalur: keluar(grup.jalur, 'omzet'),
      perMetode: keluar(grup.metode, 'omzet'),
      perPelanggan: keluar(grup.pelanggan, 'omzet', 10),
    });
  } catch (err) {
    console.error('[LAPORAN_REKAP]', err);
    return NextResponse.json({ success: false, message: 'Gagal memuat rekap penjualan' }, { status: 500 });
  }
}
