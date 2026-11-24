import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { kontak, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_EXECUTIVE } from '@/shared/lib/auth/rbac';
import { desc } from 'drizzle-orm';

// ============================================================
// API: /api/kontak
// GET (list kontak mitra/pelanggan) + POST (tambah kontak)
// ============================================================

export async function GET() {
  try {
    // Dibaca segar dari DB: akun nonaktif/dihapus langsung ditolak walau token masih berlaku
    const authResult = await requireAuthRole();
    if (!authResult.authorized) return authResult.response;

    const items = await db
      .select()
      .from(kontak)
      .orderBy(desc(kontak.createdAt));

    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_EXECUTIVE);
    if (!authResult.authorized) return authResult.response;

    const body = await req.json();
    const { nama, tipe, telepon, alamat, email, keterangan } = body;

    if (!nama) {
      return NextResponse.json({ success: false, message: 'Nama kontak wajib diisi' }, { status: 400 });
    }

    const user = authResult.user?.name || authResult.user?.username || 'System';

    const [row] = await db
      .insert(kontak)
      .values({
        nama,
        tipe: tipe || 'pelanggan',
        telepon: telepon || null,
        alamat: alamat || null,
        email: email || null,
        keterangan: keterangan || null,
        aktif: true,
      })
      .returning();

    await db.insert(logs).values({
      user,
      aksi: 'TAMBAH_KONTAK',
      detail: `Menambah data mitra [${tipe}]: ${nama}`,
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
