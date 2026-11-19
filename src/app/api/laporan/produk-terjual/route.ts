import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangKeluar, barangRusak, returBarang, inventory } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { desc } from 'drizzle-orm';

// ============================================================
// API: /api/laporan/produk-terjual
// Rekap Produk Terjual / Terbuang / Rusak by Qty
// Filter fleksibel: per hari, per jam, rentang custom
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
    const startHour = searchParams.get('startHour'); // 0 - 23
    const endHour = searchParams.get('endHour');     // 0 - 23
    const brand = searchParams.get('brand');

    // 1. Ambil seluruh master inventory
    const masterItems = await db.select().from(inventory).orderBy(inventory.namaBarang);

    // 2. Ambil data penjualan (Barang Keluar)
    const keluarList = await db.select().from(barangKeluar);

    // 3. Ambil data barang rusak
    const rusakList = await db.select().from(barangRusak);

    // 4. Ambil data retur barang
    const returList = await db.select().from(returBarang);

    // Filter tanggal & jam
    const isWithinFilter = (dateObj: Date | string | null) => {
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

      const h = d.getHours();
      if (startHour !== null && startHour !== undefined && startHour !== '') {
        if (h < parseInt(startHour, 10)) return false;
      }
      if (endHour !== null && endHour !== undefined && endHour !== '') {
        if (h > parseInt(endHour, 10)) return false;
      }

      return true;
    };

    const filteredKeluar = keluarList.filter((k) => isWithinFilter(k.tanggal));
    const filteredRusak = rusakList.filter((r) => isWithinFilter(r.tanggal));
    const filteredRetur = returList.filter((rt) => isWithinFilter(rt.tanggal));

    // 5. Agregasi per produk (SKU)
    const productMap = new Map<string, {
      sku: string;
      namaBarang: string;
      brand: string;
      stokSisa: number;
      qtyTerjual: number;
      nominalTerjual: number;
      qtyRusak: number;
      qtyRetur: number;
    }>();

    // Inisialisasi dari master
    for (const m of masterItems) {
      if (brand && brand !== 'all' && m.brand !== brand) continue;

      productMap.set(m.sku, {
        sku: m.sku,
        namaBarang: m.namaBarang,
        brand: m.brand || '-',
        stokSisa: m.stok,
        qtyTerjual: 0,
        nominalTerjual: 0,
        qtyRusak: 0,
        qtyRetur: 0,
      });
    }

    // Tambah terjual
    for (const k of filteredKeluar) {
      const entry = productMap.get(k.sku) || {
        sku: k.sku,
        namaBarang: k.namaBarang,
        brand: '-',
        stokSisa: 0,
        qtyTerjual: 0,
        nominalTerjual: 0,
        qtyRusak: 0,
        qtyRetur: 0,
      };
      entry.qtyTerjual += Number(k.qty || 0);
      entry.nominalTerjual += Number(k.total || 0);
      productMap.set(k.sku, entry);
    }

    // Tambah rusak
    for (const r of filteredRusak) {
      const entry = productMap.get(r.sku);
      if (entry) {
        entry.qtyRusak += Number(r.qty || 0);
      }
    }

    // Tambah retur
    for (const rt of filteredRetur) {
      const entry = productMap.get(rt.sku);
      if (entry) {
        entry.qtyRetur += Number(rt.qty || 0);
      }
    }

    const resultList = Array.from(productMap.values()).sort(
      (a, b) => b.qtyTerjual - a.qtyTerjual
    );

    // 6. Distribusi Penjualan Per Jam (00 - 23)
    const hourlyData: { hour: string; qty: number; nominal: number }[] = [];
    for (let h = 0; h < 24; h++) {
      const label = `${String(h).padStart(2, '0')}:00`;
      let count = 0;
      let sumNominal = 0;
      for (const k of filteredKeluar) {
        if (new Date(k.tanggal).getHours() === h) {
          count += Number(k.qty || 0);
          sumNominal += Number(k.total || 0);
        }
      }
      hourlyData.push({ hour: label, qty: count, nominal: sumNominal });
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalTerjual: resultList.reduce((acc, c) => acc + c.qtyTerjual, 0),
        totalNominal: resultList.reduce((acc, c) => acc + c.nominalTerjual, 0),
        totalRusak: resultList.reduce((acc, c) => acc + c.qtyRusak, 0),
        totalRetur: resultList.reduce((acc, c) => acc + c.qtyRetur, 0),
      },
      hourlyData,
      data: resultList,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
