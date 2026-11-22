import { NextResponse } from 'next/server';
import { requireAuthRole, ROLES_FINANCE } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';
import { auditPiutang } from '@/shared/lib/piutang';

// GET /api/piutang/audit: cocokkan faktur, riwayat pembayaran, dan kas berreferensi faktur.
export async function GET() {
  try {
    const authResult = await requireAuthRole(ROLES_FINANCE);
    if (!authResult.authorized) return authResult.response;
    return NextResponse.json({ success: true, data: await auditPiutang() });
  } catch (err) {
    return errorResponse(err, 'PIUTANG_AUDIT');
  }
}
