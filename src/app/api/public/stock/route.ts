import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { inventory } from '@/shared/lib/db/schema';
import { asc } from 'drizzle-orm';
import { requireAuthRole } from '@/shared/lib/auth/rbac';

// ============================================================
// API: /api/public/stock
// Dulu publik tanpa auth; kini wajib login (akun aktif) agar daftar stok & harga tidak terbuka
// ============================================================

export async function GET() {
  try {
    const authResult = await requireAuthRole();
    if (!authResult.authorized) return authResult.response;

    const list = await db
      .select({
        name: inventory.namaBarang,
        sku: inventory.sku,
        brand: inventory.brand,
        gramasi: inventory.gramasi,
        varian: inventory.varian,
        stock: inventory.stok,
        useKarton: inventory.pakaiKarton,
        settingPcs: inventory.settingPcs,
        price: inventory.hargaJual,
      })
      .from(inventory)
      .orderBy(asc(inventory.namaBarang));

    return NextResponse.json({ success: true, data: list });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
