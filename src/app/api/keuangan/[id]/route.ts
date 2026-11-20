import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { keuangan, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_FINANCE } from '@/shared/lib/auth/rbac';
import { eq } from 'drizzle-orm';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthRole(ROLES_FINANCE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    await db.delete(keuangan).where(eq(keuangan.id, id));

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'HAPUS_KEUANGAN',
      detail: `Menghapus catatan keuangan ID: ${id}`,
    });

    return NextResponse.json({ success: true, message: 'Data keuangan berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
