import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangRusak, inventory, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { eq, sql } from 'drizzle-orm';

// ============================================================
// API: /api/barang-rusak/[id]
// DELETE barang rusak & kembalikan stok
// Hak Akses: Divisi Gudang & Eksekutif
// ============================================================

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;

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

    const user = authResult.user?.name || authResult.user?.username || 'System';
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
