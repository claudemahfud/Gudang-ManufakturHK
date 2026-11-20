import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { returBarang, inventory, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { eq, sql } from 'drizzle-orm';

// ============================================================
// API: /api/retur-barang/[id]
// PUT (approve retur & tambah ke stok) + DELETE
// Hak Akses: Divisi Gudang & Eksekutif
// ============================================================

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;

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

    const user = authResult.user?.name || authResult.user?.username || 'System';
    let updatedResult: any;

    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(returBarang)
        .set({ status })
        .where(eq(returBarang.id, id))
        .returning();

      updatedResult = updated;

      if (tambahKeStok && item.status !== 'disetujui') {
        await tx
          .update(inventory)
          .set({
            stok: sql`${inventory.stok} + ${item.qty}`,
            updatedAt: new Date(),
          })
          .where(eq(inventory.sku, item.sku));
      }

      await tx.insert(logs).values({
        user,
        aksi: 'UPDATE_STATUS_RETUR',
        detail: `Update retur ID: ${id} status: ${status} (tambah stok: ${!!tambahKeStok})`,
      });
    });

    return NextResponse.json({ success: true, data: updatedResult });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

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
      .from(returBarang)
      .where(eq(returBarang.id, id))
      .limit(1);

    if (!item) {
      return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
    }

    await db.delete(returBarang).where(eq(returBarang.id, id));

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'HAPUS_RETUR',
      detail: `Menghapus retur ID: ${id} SKU: ${item.sku}`,
    });

    return NextResponse.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
