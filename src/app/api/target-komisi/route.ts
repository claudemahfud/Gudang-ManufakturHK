import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { targetKomisi, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { desc } from 'drizzle-orm';

// ============================================================
// API: /api/target-komisi
// GET (list target & komisi) + POST (tambah target baru)
// ============================================================

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const items = await db
      .select()
      .from(targetKomisi)
      .orderBy(desc(targetKomisi.createdAt))
      .limit(100);

    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { salesman, periode, target, realisasi, pctKomisi } = body;

    if (!salesman || !periode) {
      return NextResponse.json(
        { success: false, message: 'Nama Salesman dan Periode wajib diisi' },
        { status: 400 }
      );
    }

    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';

    const [row] = await db
      .insert(targetKomisi)
      .values({
        salesman,
        periode,
        target: String(target || 0),
        realisasi: String(realisasi || 0),
        pctKomisi: String(pctKomisi || 0),
      })
      .returning();

    await db.insert(logs).values({
      user,
      aksi: 'SET_TARGET_SALES',
      detail: `Menetapkan target periode ${periode} untuk ${salesman}: Rp ${target}`,
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
