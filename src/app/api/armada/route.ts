import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { armada, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_EXPEDISI } from '@/shared/lib/auth/rbac';
import { desc } from 'drizzle-orm';

// ============================================================
// API: /api/armada
// GET (list armada) + POST (tambah kendaraan pengangkut)
// Hak Akses: Divisi Ekspedisi, Gudang & Eksekutif
// ============================================================

export async function GET() {
  try {
    const authResult = await requireAuthRole(ROLES_EXPEDISI);
    if (!authResult.authorized) return authResult.response;

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
    const authResult = await requireAuthRole(ROLES_EXPEDISI);
    if (!authResult.authorized) return authResult.response;

    const body = await req.json();
    const { nopol, jenis, kapasitas, status, keterangan } = body;

    if (!nopol) {
      return NextResponse.json({ success: false, message: 'Nomor Polisi wajib diisi' }, { status: 400 });
    }

    const user = authResult.user?.name || authResult.user?.username || 'System';

    const [row] = await db
      .insert(armada)
      .values({
        nopol: nopol.toUpperCase().trim(),
        jenis: jenis || 'Truk Box',
        kapasitas: kapasitas || null,
        status: status || 'aktif',
        keterangan: keterangan || null,
      })
      .returning();

    await db.insert(logs).values({
      user,
      aksi: 'TAMBAH_ARMADA',
      detail: `Menambah armada kendaraan: ${nopol.toUpperCase().trim()} (${jenis || 'Truk Box'})`,
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
