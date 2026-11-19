import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangRusak, returBarang, inventory } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { desc, eq } from 'drizzle-orm';

// ============================================================
// API: /api/laporan/rusak-retur
// Laporan Barang Terbuang / Rusak & Retur Pelanggan
// ============================================================

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 1. Ambil data barang rusak join inventory untuk tahu estimasi kerugian (harga beli)
    const rusakList = await db
      .select({
        id: barangRusak.id,
        tanggal: barangRusak.tanggal,
        sku: barangRusak.sku,
        namaBarang: barangRusak.namaBarang,
        qty: barangRusak.qty,
        keterangan: barangRusak.keterangan,
        createdBy: barangRusak.createdBy,
        hargaBeli: inventory.hargaBeli,
      })
      .from(barangRusak)
      .leftJoin(inventory, eq(barangRusak.sku, inventory.sku))
      .orderBy(desc(barangRusak.tanggal));

    // 2. Ambil data retur barang
    const returList = await db
      .select()
      .from(returBarang)
      .orderBy(desc(returBarang.tanggal));

    // Filter tanggal
    const isWithin = (dateObj: Date | string | null) => {
      if (!dateObj) return false;
      const d = new Date(dateObj);
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        if (d < s) return false;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        if (d > e) return false;
      }
      return true;
    };

    const filteredRusak = rusakList.filter((r) => isWithin(r.tanggal));
    const filteredRetur = returList.filter((r) => isWithin(r.tanggal));

    // Hitung estimasi kerugian barang rusak
    let totalQtyRusak = 0;
    let totalKerugianRusak = 0;

    const rusakWithLoss = filteredRusak.map((r) => {
      const q = Number(r.qty || 0);
      const hb = Number(r.hargaBeli || 0);
      const estimasiKerugian = q * hb;
      totalQtyRusak += q;
      totalKerugianRusak += estimasiKerugian;
      return {
        ...r,
        estimasiKerugian,
      };
    });

    const totalQtyRetur = filteredRetur.reduce((acc, c) => acc + Number(c.qty || 0), 0);

    // Kategori alasan kerusakan
    const alasanMap = new Map<string, number>();
    for (const r of filteredRusak) {
      const key = r.keterangan?.trim() || 'Lain-lain / Tidak ada keterangan';
      alasanMap.set(key, (alasanMap.get(key) || 0) + Number(r.qty || 0));
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalQtyRusak,
        totalKerugianRusak,
        totalQtyRetur,
        totalKasusRetur: filteredRetur.length,
      },
      alasanBreakdown: Array.from(alasanMap.entries()).map(([alasan, qty]) => ({
        alasan,
        qty,
      })),
      rusakList: rusakWithLoss,
      returList: filteredRetur,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
