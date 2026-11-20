import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { biayaOperasional, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_EXECUTIVE } from '@/shared/lib/auth/rbac';
import { eq } from 'drizzle-orm';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthRole(ROLES_EXECUTIVE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    await db.delete(biayaOperasional).where(eq(biayaOperasional.id, id));

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'HAPUS_BIAYA_OPERASIONAL',
      detail: `Menghapus biaya operasional ID: ${id}`,
    });

    return NextResponse.json({ success: true, message: 'Biaya operasional dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
