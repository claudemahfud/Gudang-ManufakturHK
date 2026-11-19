import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { diskonRequest, logs } from '@/shared/lib/db/schema';
import { requireAuthRole } from '@/shared/lib/auth/rbac';
import { eq } from 'drizzle-orm';

// ============================================================
// API: /api/pengajuan-diskon/[id]
// PUT (approval status: approved / rejected) + DELETE
// ============================================================

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthRole(['Administrator', 'Direktur Utama', 'Manager', 'Admin Salesman']);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const { status } = await req.json();
    const user = authResult.user?.name || authResult.user?.username || 'Manager';

    const [updated] = await db
      .update(diskonRequest)
      .set({
        status, // approved | rejected
        approvedBy: user,
        updatedAt: new Date(),
      })
      .where(eq(diskonRequest.id, id))
      .returning();

    await db.insert(logs).values({
      user,
      aksi: `DISKON_${status.toUpperCase()}`,
      detail: `${status === 'approved' ? 'Menyetujui' : 'Menolak'} pengajuan diskon ID: ${id}`,
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
    const authResult = await requireAuthRole(['Administrator', 'Direktur Utama', 'Manager']);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    await db.delete(diskonRequest).where(eq(diskonRequest.id, id));

    return NextResponse.json({ success: true, message: 'Pengajuan dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
