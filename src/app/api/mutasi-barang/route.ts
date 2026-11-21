import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { mutasiBarang, inventory, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { desc, eq } from 'drizzle-orm';

// ============================================================
// API: /api/mutasi-barang
// GET (list mutasi) + POST (catat mutasi antar gudang/rak)
// ============================================================

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const items = await db
      .select()
      .from(mutasiBarang)
      .orderBy(desc(mutasiBarang.tanggal))
      .limit(100);

    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;
    const session = { user: authResult.user };

    const body = await req.json();
    const { tanggal, sku, namaBarang, qty, dari, ke, keterangan } = body;

    if (!sku || !qty || !dari || !ke) {
      return NextResponse.json(
        { success: false, message: 'SKU, Qty, Asal, dan Tujuan wajib diisi' },
        { status: 400 }
      );
    }

    const parsedQty = parseInt(qty, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return NextResponse.json(
        { success: false, message: 'Qty harus berupa angka lebih dari 0' },
        { status: 400 }
      );
    }

    const [inv] = await db
      .select()
      .from(inventory)
      .where(eq(inventory.sku, sku))
      .limit(1);

    if (!inv || (inv.stok ?? 0) < parsedQty) {
      return NextResponse.json(
        {
          success: false,
          message: `Stok tidak mencukupi untuk mutasi "${namaBarang || sku}". Stok saat ini: ${inv?.stok ?? 0}, diminta: ${parsedQty}`,
        },
        { status: 400 }
      );
    }

    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';

    const [row] = await db
      .insert(mutasiBarang)
      .values({
        tanggal: tanggal ? new Date(tanggal) : new Date(),
        sku,
        namaBarang,
        qty: parsedQty,
        dari,
        ke,
        keterangan: keterangan || null,
        createdBy: user,
      })
      .returning();

    await db.insert(logs).values({
      user,
      aksi: 'MUTASI_BARANG',
      detail: `Mutasi SKU ${sku} (${parsedQty} pcs) dari [${dari}] ke [${ke}]`,
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
