import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangMasuk, inventory, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { eq, sql } from 'drizzle-orm';

// ============================================================
// API: /api/barang-masuk/[id]
// DELETE barang masuk & rollback stok inventory
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

    // Cari data barang masuk dulu
    const [item] = await db
      .select()
      .from(barangMasuk)
      .where(eq(barangMasuk.id, id))
      .limit(1);

    if (!item) {
      return NextResponse.json(
        { success: false, message: 'Data barang masuk tidak ditemukan' },
        { status: 404 }
      );
    }

    // Rollback stok inventory
    await db
      .update(inventory)
      .set({
        stok: sql`${inventory.stok} - ${item.qty}`,
        updatedAt: new Date(),
      })
      .where(eq(inventory.sku, item.sku));

    // Hapus data barang masuk
    await db.delete(barangMasuk).where(eq(barangMasuk.id, id));

    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'HAPUS_BARANG_MASUK',
      detail: `Menghapus barang masuk ID: ${id}, SKU: ${item.sku} (${item.qty} ${item.satuan})`,
    });

    return NextResponse.json({ success: true, message: 'Data barang masuk berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
