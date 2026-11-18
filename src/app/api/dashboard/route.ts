import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { inventory, barangMasuk, barangKeluar } from '@/shared/lib/db/schema';
import { sql, and, gte, lte, asc, desc } from 'drizzle-orm';
import { auth } from '@/shared/lib/auth/config';

// ============================================================
// API ROUTE: Dashboard Stats & Summary
// Endpoint: GET /api/dashboard
// ============================================================

export async function GET() {
  try {
    // 1. Cek Autentikasi
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Harap login terlebih dahulu' },
        { status: 401 }
      );
    }

    // 2. Rentang Waktu Hari Ini (WIB / Local)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // 3. Query Statistik Inventory
    const [invStats] = await db
      .select({
        totalSKU: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        totalInventory: sql<number>`COALESCE(SUM(${inventory.stok} * CAST(${inventory.hargaJual} AS NUMERIC)), 0)::FLOAT`,
        stokKritis: sql<number>`CAST(COUNT(CASE WHEN ${inventory.stok} <= COALESCE(${inventory.stokMinimum}, 10) THEN 1 END) AS INTEGER)`,
      })
      .from(inventory);

    // 4. Query Barang Masuk Hari Ini
    const [masukStats] = await db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(barangMasuk)
      .where(
        and(
          gte(barangMasuk.tanggal, startOfDay),
          lte(barangMasuk.tanggal, endOfDay)
        )
      );

    // 5. Query Barang Keluar Hari Ini
    const [keluarStats] = await db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(barangKeluar)
      .where(
        and(
          gte(barangKeluar.tanggal, startOfDay),
          lte(barangKeluar.tanggal, endOfDay)
        )
      );

    // 6. Query Stok per Brand (untuk Recharts Bar Chart)
    const brandStats = await db
      .select({
        brand: sql<string>`COALESCE(NULLIF(TRIM(${inventory.brand}), ''), 'Lainnya')`,
        stok: sql<number>`CAST(COALESCE(SUM(${inventory.stok}), 0) AS INTEGER)`,
      })
      .from(inventory)
      .groupBy(sql`COALESCE(NULLIF(TRIM(${inventory.brand}), ''), 'Lainnya')`)
      .orderBy(desc(sql`SUM(${inventory.stok})`))
      .limit(8);

    // 7. Query 5 Barang Stok Kritis Terbaru
    const kritisItems = await db
      .select({
        id: inventory.id,
        sku: inventory.sku,
        namaBarang: inventory.namaBarang,
        brand: inventory.brand,
        gramasi: inventory.gramasi,
        varian: inventory.varian,
        stok: inventory.stok,
        stokMinimum: inventory.stokMinimum,
        settingPcs: inventory.settingPcs,
        pakaiKarton: inventory.pakaiKarton,
        hargaJual: inventory.hargaJual,
        updatedAt: inventory.updatedAt,
      })
      .from(inventory)
      .where(sql`${inventory.stok} <= COALESCE(${inventory.stokMinimum}, 10)`)
      .orderBy(asc(inventory.stok), desc(inventory.updatedAt))
      .limit(5);

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalInventory: Number(invStats?.totalInventory) || 0,
          totalSKU: Number(invStats?.totalSKU) || 0,
          stokKritis: Number(invStats?.stokKritis) || 0,
          barangMasukHariIni: Number(masukStats?.count) || 0,
          barangKeluarHariIni: Number(keluarStats?.count) || 0,
        },
        chartData: brandStats || [],
        kritisItems: kritisItems || [],
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan internal server';
    console.error('Error in GET /api/dashboard:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
