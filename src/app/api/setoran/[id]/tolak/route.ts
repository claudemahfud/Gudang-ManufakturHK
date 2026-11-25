import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { requireAuthRole, ROLES_FINANCE_SETORAN } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';
import { tolakSetoran } from '@/shared/lib/setoran';

// POST /api/setoran/[id]/tolak {alasan}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthRole(ROLES_FINANCE_SETORAN);
    if (!auth.authorized) return auth.response;
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const username = String(auth.user?.username ?? '');
    const hasil = await db.transaction((tx) => tolakSetoran(tx, id, String(body?.alasan ?? ''), { username, nama: String(auth.user?.name || username) }));
    return NextResponse.json({ success: true, data: hasil });
  } catch (err) {
    return errorResponse(err, 'SETORAN_TOLAK');
  }
}
