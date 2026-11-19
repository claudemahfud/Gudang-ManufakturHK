import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { targetKomisi, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_SALES_OPS } from '@/shared/lib/auth/rbac';
import { desc, eq } from 'drizzle-orm';

// ============================================================
// API: /api/target-komisi
// GET (list target & komisi) + POST (tambah target baru)
// ============================================================

export async function GET() {
  try {
    const authResult = await requireAuthRole(ROLES_SALES_OPS);
    if (!authResult.authorized) return authResult.response;

    const { user, userRole } = authResult;

    // Jika sales biasa, hanya boleh melihat target & komisi miliknya sendiri
    let query = db.select().from(targetKomisi);
    let items;
    if (userRole === 'Salesman' || userRole === 'Agen') {
      items = await db
        .select()
        .from(targetKomisi)
        .where(eq(targetKomisi.salesman, user.name || user.username))
        .orderBy(desc(targetKomisi.createdAt))
        .limit(100);
    } else {
      items = await db
        .select()
        .from(targetKomisi)
        .orderBy(desc(targetKomisi.createdAt))
        .limit(100);
    }

    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Hanya manajemen / admin salesman yang boleh membuat/mengubah target
    const authResult = await requireAuthRole(['Administrator', 'Direktur Utama', 'Manager', 'Admin Salesman']);
    if (!authResult.authorized) return authResult.response;

    const body = await req.json();
    const { salesman, periode, target, realisasi, pctKomisi } = body;

    if (!salesman || !periode) {
      return NextResponse.json(
        { success: false, message: 'Nama Salesman dan Periode wajib diisi' },
        { status: 400 }
      );
    }

    const user = authResult.user?.name || authResult.user?.username || 'System';

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
