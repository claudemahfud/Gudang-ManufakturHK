import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { biayaOperasional, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { desc } from 'drizzle-orm';

// ============================================================
// API: /api/biaya-operasional
// GET (list biaya ops) + POST (catat biaya operasional)
// ============================================================

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const items = await db
      .select()
      .from(biayaOperasional)
      .orderBy(desc(biayaOperasional.tanggal))
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
    const { tanggal, kategori, jumlah, keterangan } = body;

    if (!kategori || !jumlah) {
      return NextResponse.json(
        { success: false, message: 'Kategori dan Jumlah wajib diisi' },
        { status: 400 }
      );
    }

    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';

    const [row] = await db
      .insert(biayaOperasional)
      .values({
        tanggal: tanggal ? new Date(tanggal) : new Date(),
        kategori,
        jumlah: String(jumlah),
        keterangan: keterangan || null,
        createdBy: user,
      })
      .returning();

    await db.insert(logs).values({
      user,
      aksi: 'BIAYA_OPERASIONAL',
      detail: `Catat biaya operasional [${kategori}]: Rp ${jumlah}`,
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
