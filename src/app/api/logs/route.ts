import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_ADMIN, ROLES_EXECUTIVE } from '@/shared/lib/auth/rbac';
import { desc, lt } from 'drizzle-orm';

const LOG_RETENTION_DAYS = 90;

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

    // Audit trail tidak boleh dihapus total: hanya log lebih tua dari masa simpan
    const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const removed = await db.delete(logs).where(lt(logs.createdAt, cutoff)).returning({ id: logs.id });

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'BERSIHKAN_LOG',
      detail: `Menghapus ${removed.length} log aktivitas lebih tua dari ${LOG_RETENTION_DAYS} hari`,
    });

    return NextResponse.json({
      success: true,
      message: `${removed.length} log lebih tua dari ${LOG_RETENTION_DAYS} hari telah dibersihkan`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
