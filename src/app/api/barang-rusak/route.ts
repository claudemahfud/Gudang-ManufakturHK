import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangRusak, inventory, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { eq, desc, sql } from 'drizzle-orm';

// ============================================================
// API: /api/barang-rusak
// GET (list barang rusak) + POST (catat barang rusak & potong stok)
// ============================================================

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const items = await db
      .select()
      .from(barangRusak)
      .orderBy(desc(barangRusak.tanggal))
      .limit(100);

    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tanggal, sku, namaBarang, qty, keterangan } = body;

    if (!sku || !qty) {
      return NextResponse.json(
        { success: false, message: 'SKU dan Qty wajib diisi' },
        { status: 400 }
      );
    }

    const parsedQty = parseInt(qty, 10);
    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';

    const [row] = await db
      .insert(barangRusak)
      .values({
        tanggal: tanggal ? new Date(tanggal) : new Date(),
        sku,
        namaBarang,
        qty: parsedQty,
        keterangan: keterangan || null,
        createdBy: user,
      })
      .returning();

    // Potong stok dari inventory
    await db
      .update(inventory)
      .set({
        stok: sql`${inventory.stok} - ${parsedQty}`,
        updatedAt: new Date(),
      })
      .where(eq(inventory.sku, sku));

    await db.insert(logs).values({
      user,
      aksi: 'BARANG_RUSAK',
      detail: `Mencatat barang rusak SKU: ${sku} (-${parsedQty} pcs). Ket: ${keterangan || '-'}`,
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
