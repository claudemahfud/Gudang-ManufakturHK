import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangRusak, inventory, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { eq, desc, sql } from 'drizzle-orm';

// ============================================================
// API: /api/barang-rusak
// GET (list barang rusak) + POST (catat barang rusak & potong stok)
// ============================================================

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const divisi = searchParams.get('divisi');

    let items = await db
      .select()
      .from(barangRusak)
      .orderBy(desc(barangRusak.tanggal))
      .limit(100);

    if (divisi && divisi !== 'SEMUA') {
      items = items.filter((item: any) => !item.divisi || item.divisi === divisi);
    }

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
    const { tanggal, sku, namaBarang, qty, keterangan, divisi = 'MANUFAKTUR' } = body;

    if (!sku || !qty) {
      return NextResponse.json(
        { success: false, message: 'SKU dan Qty wajib diisi' },
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
          message: `Stok tidak mencukupi untuk mencatat barang rusak "${namaBarang || sku}". Stok tersedia: ${inv?.stok ?? 0}, diminta: ${parsedQty}`,
        },
        { status: 400 }
      );
    }

    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';

    const [row] = await db
      .insert(barangRusak)
      .values({
        tanggal: tanggal ? new Date(tanggal) : new Date(),
        sku,
        namaBarang,
        qty: parsedQty,
        divisi,
        keterangan: keterangan || null,
        createdBy: user,
      })
      .returning();

    // Potong stok dari inventory
    await db
      .update(inventory)
      .set({
        stok: sql`${inventory.stok} - ${parsedQty}`,
        updatedAt: new Date(),
      })
      .where(eq(inventory.sku, sku));

    await db.insert(logs).values({
      user,
      aksi: 'BARANG_RUSAK',
      detail: `Mencatat barang rusak SKU: ${sku} (-${parsedQty} pcs). Ket: ${keterangan || '-'}`,
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
