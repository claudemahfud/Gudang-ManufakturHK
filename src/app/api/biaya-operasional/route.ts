import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { biayaOperasional, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_FINANCE } from '@/shared/lib/auth/rbac';
import { desc } from 'drizzle-orm';

// ============================================================
// API: /api/biaya-operasional
// GET (list biaya ops) + POST (catat biaya operasional)
// ============================================================

export async function GET() {
  try {
    const authResult = await requireAuthRole(ROLES_FINANCE);
    if (!authResult.authorized) return authResult.response;

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
    const authResult = await requireAuthRole(ROLES_FINANCE);
    if (!authResult.authorized) return authResult.response;

    const body = await req.json();
    const { tanggal, kategori, jumlah, keterangan } = body;

    const parsedJumlah = Number(jumlah);
    if (!kategori || isNaN(parsedJumlah) || parsedJumlah <= 0) {
      return NextResponse.json(
        { success: false, message: 'Kategori dan Jumlah (harus lebih dari 0) wajib diisi' },
        { status: 400 }
      );
    }

    const user = authResult.user?.name || authResult.user?.username || 'System';

    const [row] = await db
      .insert(biayaOperasional)
      .values({
        tanggal: tanggal ? new Date(tanggal) : new Date(),
        kategori,
        jumlah: String(parsedJumlah),
        keterangan: keterangan || null,
        createdBy: user,
      })
      .returning();

    await db.insert(logs).values({
      user,
      aksi: 'BIAYA_OPERASIONAL',
      detail: `Catat biaya operasional [${kategori}]: Rp ${parsedJumlah.toLocaleString('id-ID')}`,
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
