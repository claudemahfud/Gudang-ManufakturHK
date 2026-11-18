import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { armada, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { desc } from 'drizzle-orm';

// ============================================================
// API: /api/armada
// GET (list armada) + POST (tambah kendaraan pengangkut)
// ============================================================

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const items = await db
      .select()
      .from(armada)
      .orderBy(desc(armada.createdAt));

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
    const { nopol, jenis, kapasitas, status, keterangan } = body;

    if (!nopol) {
      return NextResponse.json({ success: false, message: 'Nomor Polisi wajib diisi' }, { status: 400 });
    }

    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';

    const [row] = await db
      .insert(armada)
      .values({
        nopol: nopol.toUpperCase(),
        jenis: jenis || 'Truk Box',
        kapasitas: kapasitas || null,
        status: status || 'aktif',
        keterangan: keterangan || null,
      })
      .returning();

    await db.insert(logs).values({
      user,
      aksi: 'TAMBAH_ARMADA',
      detail: `Menambah armada kendaraan: ${nopol.toUpperCase()} (${jenis || 'Truk Box'})`,
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
