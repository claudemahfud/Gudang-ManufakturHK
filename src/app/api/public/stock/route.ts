import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { inventory } from '@/shared/lib/db/schema';
import { asc } from 'drizzle-orm';

// ============================================================
// API: /api/public/stock
// Akses publik tanpa auth (untuk integrasi luar & cek stok live)
// ============================================================

export async function GET() {
  try {
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
