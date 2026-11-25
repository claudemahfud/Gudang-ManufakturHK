import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { requireAuthRole, ROLES_SALES_SETORAN } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';
import { batalSetoran } from '@/shared/lib/setoran';

// DELETE /api/setoran/[id]: sales membatalkan pengajuannya sendiri selama masih menunggu
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthRole(ROLES_SALES_SETORAN);
    if (!auth.authorized) return auth.response;
    const { id } = await params;
    await db.transaction((tx) => batalSetoran(tx, id, String(auth.user?.username ?? '')));
    return NextResponse.json({ success: true, message: 'Setoran dibatalkan' });
  } catch (err) {
    return errorResponse(err, 'SETORAN_BATAL');
  }
}
