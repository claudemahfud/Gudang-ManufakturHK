import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangRusak, inventory, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { eq, sql } from 'drizzle-orm';

// ============================================================
// API: /api/barang-rusak/[id]
// DELETE barang rusak & kembalikan stok
// ============================================================

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

    const [item] = await db
      .select()
      .from(barangRusak)
      .where(eq(barangRusak.id, id))
      .limit(1);

    if (!item) {
      return NextResponse.json(
        { success: false, message: 'Data tidak ditemukan' },
        { status: 404 }
      );
    }

    // Kembalikan stok
    await db
      .update(inventory)
      .set({
        stok: sql`${inventory.stok} + ${item.qty}`,
        updatedAt: new Date(),
      })
      .where(eq(inventory.sku, item.sku));

    await db.delete(barangRusak).where(eq(barangRusak.id, id));

    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'BATAL_BARANG_RUSAK',
      detail: `Membatalkan pencatatan rusak SKU: ${item.sku} (+${item.qty} pcs)`,
    });

    return NextResponse.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
