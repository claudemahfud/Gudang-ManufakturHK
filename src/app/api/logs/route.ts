import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { desc } from 'drizzle-orm';

// ============================================================
// API: /api/logs
// GET (riwayat audit trail) + DELETE (bersihkan logs lama)
// ============================================================

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

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
    const session = await auth();
    if (!session || (session.user as any)?.role !== 'Administrator') {
      return NextResponse.json({ success: false, message: 'Hanya Administrator yang dapat membersihkan log' }, { status: 403 });
    }

    await db.delete(logs);

    return NextResponse.json({ success: true, message: 'Seluruh riwayat log aktivitas telah dibersihkan' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
