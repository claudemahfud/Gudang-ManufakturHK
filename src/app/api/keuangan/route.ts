import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { keuangan, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_FINANCE } from '@/shared/lib/auth/rbac';
import { desc } from 'drizzle-orm';

// ============================================================
// API: /api/keuangan
// GET (list arus kas) + POST (catat pemasukan / pengeluaran)
// ============================================================

export async function GET(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_FINANCE);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(req.url);
    const divisi = searchParams.get('divisi');

    let items = await db
      .select()
      .from(keuangan)
      .orderBy(desc(keuangan.tanggal))
      .limit(100);

    if (divisi && divisi !== 'SEMUA') {
      items = items.filter((item) => item.divisi === divisi);
    }

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
    const { tanggal, jenis, kategori, jumlah, keterangan, divisi = 'MANUFAKTUR' } = body;

    if (!jenis || !kategori || !jumlah) {
      return NextResponse.json(
        { success: false, message: 'Jenis, Kategori, dan Jumlah wajib diisi' },
        { status: 400 }
      );
    }

    const user = authResult.user?.name || authResult.user?.username || 'System';

    const [row] = await db
      .insert(keuangan)
      .values({
        tanggal: tanggal ? new Date(tanggal) : new Date(),
        jenis, // masuk | keluar
        kategori,
        jumlah: String(jumlah),
        divisi,
        keterangan: keterangan || null,
        createdBy: user,
      })
      .returning();

    await db.insert(logs).values({
      user,
      aksi: 'CATAT_KEUANGAN',
      detail: `Catat arus kas (${jenis.toUpperCase()}) ${kategori}: Rp ${jumlah}`,
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
