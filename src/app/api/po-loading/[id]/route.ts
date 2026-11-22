import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { poLoading, poLoadingItems, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { eq } from 'drizzle-orm';
import { BusinessError, errorResponse } from '@/shared/lib/stock';
import { PO_STATUS } from '@/shared/lib/po-status';

// ============================================================
// API: /api/po-loading/[id]
// GET (detail + items), PUT (batalkan PO), DELETE (hanya bila belum ada barang diterima)
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

// PO hanya dokumen pemesanan: tidak menambah stok. Penerimaan barang lewat
// Barang Masuk > "Barang Datang" (POST /api/po-loading/[id]/faktur).
// PUT di sini hanya untuk membatalkan PO yang belum selesai.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const body = await req.json();
    const user = authResult.user?.name || authResult.user?.username || 'System';

    if (body.status !== PO_STATUS.BATAL) {
      return NextResponse.json(
        {
          success: false,
          message: 'Status PO hanya bisa diubah menjadi dibatalkan. Penerimaan barang dilakukan di menu Barang Masuk > Barang Datang.',
        },
        { status: 400 }
      );
    }

    const updated = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(poLoading).where(eq(poLoading.id, id)).for('update').limit(1);
      if (!current) throw new BusinessError('PO tidak ditemukan', 404);
      if (current.status === PO_STATUS.SELESAI) throw new BusinessError('PO sudah selesai diterima dan tidak bisa dibatalkan.');
      if (current.status === PO_STATUS.BATAL) return current;

      const [row] = await tx
        .update(poLoading)
        .set({ status: PO_STATUS.BATAL, updatedAt: new Date() })
        .where(eq(poLoading.id, id))
        .returning();

      await tx.insert(logs).values({
        user,
        aksi: 'UPDATE_PO_LOADING',
        detail: `Batalkan ${current.noPo}: status ${current.status} -> ${PO_STATUS.BATAL}`,
      });
      return row;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return errorResponse(err, 'PO_LOADING_PUT');
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
      const [po] = await tx.select().from(poLoading).where(eq(poLoading.id, id)).for('update').limit(1);
      if (!po) throw new BusinessError('PO tidak ditemukan', 404);

      // Barang PO yang sudah diterima tercatat di Barang Masuk & stok: PO-nya wajib tetap ada
      const items = await tx.select().from(poLoadingItems).where(eq(poLoadingItems.poLoadingId, id));
      if (items.some((it) => it.qtyTerima > 0)) {
        throw new BusinessError(
          `${po.noPo} tidak bisa dihapus karena sebagian/semua barangnya sudah diterima lewat Faktur Pembelian. Batalkan PO bila sisa barang tidak akan datang.`
        );
      }

      await tx.delete(poLoadingItems).where(eq(poLoadingItems.poLoadingId, id));
      await tx.delete(poLoading).where(eq(poLoading.id, id));

      await tx.insert(logs).values({
        user,
        aksi: 'HAPUS_PO_LOADING',
        detail: `Menghapus ${po.noPo} (${po.supplier || '-'})`,
      });
    });

    return NextResponse.json({ success: true, message: 'PO berhasil dihapus' });
  } catch (err) {
    return errorResponse(err, 'PO_LOADING_DELETE');
  }
}
