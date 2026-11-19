import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_ADMIN, ROLES_EXECUTIVE } from '@/shared/lib/auth/rbac';
import { desc } from 'drizzle-orm';

// ============================================================
// API: /api/logs
// GET (riwayat audit trail) + DELETE (bersihkan logs lama)
// ============================================================

export async function GET() {
  try {
    const authResult = await requireAuthRole(ROLES_EXECUTIVE);
    if (!authResult.authorized) return authResult.response;

    const items = await db
      .select()
      .from(logs)
      .orderBy(desc(logs.tanggal))
      .limit(150);

    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const authResult = await requireAuthRole(ROLES_ADMIN);
    if (!authResult.authorized) return authResult.response;

    await db.delete(logs);

    return NextResponse.json({ success: true, message: 'Seluruh riwayat log aktivitas telah dibersihkan' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
