import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { diskonRequest, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_SALES_OPS } from '@/shared/lib/auth/rbac';
import { desc, eq } from 'drizzle-orm';

// ============================================================
// API: /api/pengajuan-diskon
// GET (list request) + POST (sales ajukan diskon khusus)
// ============================================================

export async function GET() {
  try {
    const authResult = await requireAuthRole(ROLES_SALES_OPS);
    if (!authResult.authorized) return authResult.response;

    const { user, userRole } = authResult;

    // Jika Salesman biasa, hanya tampilkan permohonan diskon miliknya sendiri
    let items;
    if (userRole === 'Salesman' || userRole === 'Agen') {
      items = await db
        .select()
        .from(diskonRequest)
        .where(eq(diskonRequest.salesman, user.name || user.username))
        .orderBy(desc(diskonRequest.createdAt))
        .limit(100);
    } else {
      items = await db
        .select()
        .from(diskonRequest)
        .orderBy(desc(diskonRequest.createdAt))
        .limit(100);
    }

    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_SALES_OPS);
    if (!authResult.authorized) return authResult.response;

    const body = await req.json();
    const { tanggal, salesman, pelanggan, sku, namaBarang, qty, diskonPct, alasan } = body;

    if (!pelanggan || !diskonPct) {
      return NextResponse.json(
        { success: false, message: 'Pelanggan dan Persentase diskon wajib diisi' },
        { status: 400 }
      );
    }

    const user = authResult.user?.name || authResult.user?.username || 'System';

    const [row] = await db
      .insert(diskonRequest)
      .values({
        tanggal: tanggal ? new Date(tanggal) : new Date(),
        salesman: salesman || user,
        pelanggan,
        sku: sku || null,
        namaBarang: namaBarang || null,
        qty: qty ? parseInt(qty, 10) : null,
        diskonPct: String(diskonPct),
        alasan: alasan || null,
        status: 'pending',
      })
      .returning();

    await db.insert(logs).values({
      user,
      aksi: 'AJUKAN_DISKON',
      detail: `Sales ${salesman || user} mengajukan diskon ${diskonPct}% untuk ${pelanggan}`,
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
