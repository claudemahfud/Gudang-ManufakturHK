import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { targetKomisi, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_EXECUTIVE } from '@/shared/lib/auth/rbac';
import { eq } from 'drizzle-orm';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthRole(ROLES_EXECUTIVE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const body = await req.json();

    const [updated] = await db
      .update(targetKomisi)
      .set({
        target: body.target ? String(body.target) : undefined,
        realisasi: body.realisasi ? String(body.realisasi) : undefined,
        pctKomisi: body.pctKomisi ? String(body.pctKomisi) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(targetKomisi.id, id))
      .returning();

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'UPDATE_TARGET_KOMISI',
      detail: `Update target komisi ID: ${id}`,
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
    const authResult = await requireAuthRole(ROLES_EXECUTIVE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    await db.delete(targetKomisi).where(eq(targetKomisi.id, id));

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'HAPUS_TARGET_KOMISI',
      detail: `Menghapus target komisi ID: ${id}`,
    });

    return NextResponse.json({ success: true, message: 'Target komisi dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
