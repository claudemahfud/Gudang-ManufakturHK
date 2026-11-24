import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { inventory, barangMasuk, barangKeluar } from '@/shared/lib/db/schema';
import { sql, and, gte, lte, asc, desc, eq } from 'drizzle-orm';
import { requireAuthRole } from '@/shared/lib/auth/rbac';

// ============================================================
// API ROUTE: Dashboard Stats & Summary (Multi-Domain Filtered)
// Endpoint: GET /api/dashboard?divisi=MANUFAKTUR|FNB
// ============================================================

export async function GET(req: NextRequest) {
  try {
    // 1. Cek Autentikasi
    // Dibaca segar dari DB: akun nonaktif/dihapus langsung ditolak walau token masih berlaku
    const authResult = await requireAuthRole();
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(req.url);
    const divisiParam = searchParams.get('divisi') || req.cookies.get('app_active_division')?.value || 'MANUFAKTUR';

    // 2. Rentang Waktu Hari Ini (WIB / Local)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const isFiltered = divisiParam && divisiParam !== 'SEMUA';
    const invDivisiCond = isFiltered ? eq(inventory.divisi, divisiParam) : undefined;
    const bmDivisiCond = isFiltered ? eq(barangMasuk.divisi, divisiParam) : undefined;
    const bkDivisiCond = isFiltered ? eq(barangKeluar.divisi, divisiParam) : undefined;

    // 3. Query Statistik Inventory
    const [invStats] = await db
      .select({
        totalSKU: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        totalInventory: sql<number>`COALESCE(SUM(${inventory.stok} * CAST(${inventory.hargaJual} AS NUMERIC)), 0)::FLOAT`,
        stokKritis: sql<number>`CAST(COUNT(CASE WHEN ${inventory.stok} <= COALESCE(${inventory.stokMinimum}, 10) THEN 1 END) AS INTEGER)`,
      })
      .from(inventory)
      .where(invDivisiCond);

    // 4. Query Barang Masuk Hari Ini
    const bmConditions = [
      gte(barangMasuk.tanggal, startOfDay),
      lte(barangMasuk.tanggal, endOfDay),
    ];
    if (bmDivisiCond) bmConditions.push(bmDivisiCond);

    const [masukStats] = await db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(barangMasuk)
      .where(and(...bmConditions));

    // 5. Query Barang Keluar Hari Ini
    const bkConditions = [
      gte(barangKeluar.tanggal, startOfDay),
      lte(barangKeluar.tanggal, endOfDay),
    ];
    if (bkDivisiCond) bkConditions.push(bkDivisiCond);

    const [keluarStats] = await db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(barangKeluar)
      .where(and(...bkConditions));

    // 6. Query Data Grafik Stok per Brand (Top 10)
    const chartData = await db
      .select({
        brand: sql<string>`COALESCE(${inventory.brand}, 'Lainnya')`,
        stok: sql<number>`CAST(SUM(${inventory.stok}) AS INTEGER)`,
      })
      .from(inventory)
      .where(invDivisiCond)
      .groupBy(inventory.brand)
      .orderBy(desc(sql`SUM(${inventory.stok})`))
      .limit(10);

    // 7. Query Barang Stok Kritis
    const kritisCond = sql`${inventory.stok} <= COALESCE(${inventory.stokMinimum}, 10)`;
    const kritisWhere = invDivisiCond ? and(kritisCond, invDivisiCond) : kritisCond;

    const kritisItems = await db
      .select()
      .from(inventory)
      .where(kritisWhere)
      .orderBy(asc(inventory.stok))
      .limit(5);

    // Response Data
    return NextResponse.json({
      success: true,
      data: {
        divisi: divisiParam,
        stats: {
          totalSKU: Number(invStats?.totalSKU) || 0,
          totalInventory: Number(invStats?.totalInventory) || 0,
          stokKritis: Number(invStats?.stokKritis) || 0,
          barangMasukHariIni: Number(masukStats?.count) || 0,
          barangKeluarHariIni: Number(keluarStats?.count) || 0,
        },
        chartData: chartData.map((item) => ({
          brand: item.brand,
          stok: Number(item.stok) || 0,
        })),
        kritisItems,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan sistem';
    console.error('Error in GET /api/dashboard:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
