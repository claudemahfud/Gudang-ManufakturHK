import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { akun } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';

// GET /api/akuntansi/akun: Bagan Akun (COA) aktif, urut laporan
export async function GET() {
  try {
    const auth = await requireAuthRole(ROLES_PEMBUKUAN);
    if (!auth.authorized) return auth.response;
    const rows = await db.select().from(akun).where(eq(akun.aktif, true)).orderBy(asc(akun.urutan));
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    return errorResponse(err, 'AKUN_GET');
  }
}
