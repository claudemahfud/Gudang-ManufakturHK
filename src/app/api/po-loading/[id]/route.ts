import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { poLoading, poLoadingItems, inventory, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { eq, sql } from 'drizzle-orm';

// ============================================================
// API: /api/po-loading/[id]
// GET, PUT (update status/terima barang), DELETE
// ============================================================

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [header] = await db
      .select()
      .from(poLoading)
      .where(eq(poLoading.id, id))
      .limit(1);

    if (!header) {
      return NextResponse.json({ success: false, message: 'PO tidak ditemukan' }, { status: 404 });
    }

    const items = await db
      .select()
      .from(poLoadingItems)
      .where(eq(poLoadingItems.poLoadingId, id));

    return NextResponse.json({ success: true, data: { ...header, items } });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const body = await req.json();
    const { status, receiveAll } = body;
    const user = authResult.user?.name || authResult.user?.username || 'System';

    let updatedResult: any;

    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(poLoading)
        .set({ status, updatedAt: new Date() })
        .where(eq(poLoading.id, id))
        .returning();

      updatedResult = updated;

      // Jika receiveAll: tambah semua qtyOrder ke inventory
      if (receiveAll) {
        const items = await tx
          .select()
          .from(poLoadingItems)
          .where(eq(poLoadingItems.poLoadingId, id));

        for (const it of items) {
          await tx
            .update(inventory)
            .set({
              stok: sql`${inventory.stok} + ${it.qtyOrder}`,
              updatedAt: new Date(),
            })
            .where(eq(inventory.sku, it.sku));

          await tx
            .update(poLoadingItems)
            .set({ qtyTerima: it.qtyOrder })
            .where(eq(poLoadingItems.id, it.id));
        }
      }

      await tx.insert(logs).values({
        user,
        aksi: 'UPDATE_PO_LOADING',
        detail: `Update PO ID: ${id} status: ${status}${receiveAll ? ' (Semua barang diterima ke stok)' : ''}`,
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
    const user = authResult.user?.name || authResult.user?.username || 'System';

    await db.transaction(async (tx) => {
      // Hapus child items terlebih dahulu
      await tx.delete(poLoadingItems).where(eq(poLoadingItems.poLoadingId, id));
      await tx.delete(poLoading).where(eq(poLoading.id, id));

      await tx.insert(logs).values({
        user,
        aksi: 'HAPUS_PO_LOADING',
        detail: `Menghapus PO & Loading sheet ID: ${id}`,
      });
    });

    return NextResponse.json({ success: true, message: 'PO berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
