import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { returBarang, inventory, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { eq, sql } from 'drizzle-orm';

// ============================================================
// API: /api/retur-barang/[id]
// PUT (approve retur & tambah ke stok) + DELETE
// ============================================================

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { status, tambahKeStok } = await req.json();

    const [item] = await db
      .select()
      .from(returBarang)
      .where(eq(returBarang.id, id))
      .limit(1);

    if (!item) {
      return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
    }

    const [updated] = await db
      .update(returBarang)
      .set({ status })
      .where(eq(returBarang.id, id))
      .returning();

    if (tambahKeStok && item.status !== 'disetujui') {
      await db
        .update(inventory)
        .set({
          stok: sql`${inventory.stok} + ${item.qty}`,
          updatedAt: new Date(),
        })
        .where(eq(inventory.sku, item.sku));
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await db.delete(returBarang).where(eq(returBarang.id, id));

    return NextResponse.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
