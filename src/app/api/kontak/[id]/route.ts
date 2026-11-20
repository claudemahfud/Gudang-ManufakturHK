import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { kontak, logs } from '@/shared/lib/db/schema';
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
      .update(kontak)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(kontak.id, id))
      .returning();

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'UPDATE_KONTAK',
      detail: `Update kontak ID: ${id} (${updated?.nama || ''})`,
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

    const [item] = await db
      .select()
      .from(kontak)
      .where(eq(kontak.id, id))
      .limit(1);

    if (!item) {
      return NextResponse.json({ success: false, message: 'Kontak tidak ditemukan' }, { status: 404 });
    }

    await db.delete(kontak).where(eq(kontak.id, id));

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'HAPUS_KONTAK',
      detail: `Menghapus kontak ID: ${id} (${item.nama})`,
    });

    return NextResponse.json({ success: true, message: 'Kontak berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
