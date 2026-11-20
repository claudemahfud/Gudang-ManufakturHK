import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { armada, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_EXPEDISI } from '@/shared/lib/auth/rbac';
import { eq } from 'drizzle-orm';

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
      .update(armada)
      .set({ status })
      .where(eq(armada.id, id))
      .returning();

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'UPDATE_ARMADA',
      detail: `Update armada ID: ${id} status: ${status}`,
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
    await db.delete(armada).where(eq(armada.id, id));

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'HAPUS_ARMADA',
      detail: `Menghapus armada ID: ${id}`,
    });

    return NextResponse.json({ success: true, message: 'Armada dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
