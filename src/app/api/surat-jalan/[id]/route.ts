import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { suratJalan, suratJalanItems, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_EXPEDISI } from '@/shared/lib/auth/rbac';
import { eq } from 'drizzle-orm';

// ============================================================
// API: /api/surat-jalan/[id]
// GET detail (dengan items), PUT (update status), DELETE
// ============================================================

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Dibaca segar dari DB: akun nonaktif/dihapus langsung ditolak walau token masih berlaku
    const authResult = await requireAuthRole();
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;

    const [header] = await db
      .select()
      .from(suratJalan)
      .where(eq(suratJalan.id, id))
      .limit(1);

    if (!header) {
      return NextResponse.json({ success: false, message: 'Surat jalan tidak ditemukan' }, { status: 404 });
    }

    const items = await db
      .select()
      .from(suratJalanItems)
      .where(eq(suratJalanItems.suratJalanId, id));

    return NextResponse.json({
      success: true,
      data: {
        ...header,
        items,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthRole(ROLES_EXPEDISI);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const { status } = await req.json();

    const [updated] = await db
      .update(suratJalan)
      .set({ status, updatedAt: new Date() })
      .where(eq(suratJalan.id, id))
      .returning();

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'UPDATE_STATUS_SURAT_JALAN',
      detail: `Update status surat jalan ID: ${id} menjadi ${status}`,
    });

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
    const authResult = await requireAuthRole(ROLES_EXPEDISI);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;

    const user = authResult.user?.name || authResult.user?.username || 'System';

    await db.transaction(async (tx) => {
      // Hapus child items terlebih dahulu agar tidak melanggar foreign key constraint
      await tx.delete(suratJalanItems).where(eq(suratJalanItems.suratJalanId, id));
      await tx.delete(suratJalan).where(eq(suratJalan.id, id));

      await tx.insert(logs).values({
        user,
        aksi: 'HAPUS_SURAT_JALAN',
        detail: `Menghapus surat jalan beserta item ID: ${id}`,
      });
    });

    return NextResponse.json({ success: true, message: 'Surat jalan berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
