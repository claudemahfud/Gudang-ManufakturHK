import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { returBarang, inventory, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { desc, eq, sql } from 'drizzle-orm';

// ============================================================
// API: /api/retur-barang
// GET (list retur) + POST (catat pengajuan retur)
// ============================================================

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const items = await db
      .select()
      .from(returBarang)
      .orderBy(desc(returBarang.tanggal))
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
    const { tanggal, sku, namaBarang, qty, alasan, pelanggan, kembaliKeStok } = body;

    if (!sku || !qty) {
      return NextResponse.json(
        { success: false, message: 'SKU dan Qty wajib diisi' },
        { status: 400 }
      );
    }

    const parsedQty = parseInt(qty, 10);
    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';

    const [row] = await db
      .insert(returBarang)
      .values({
        tanggal: tanggal ? new Date(tanggal) : new Date(),
        sku,
        namaBarang,
        qty: parsedQty,
        alasan: alasan || null,
        pelanggan: pelanggan || null,
        status: kembaliKeStok ? 'disetujui' : 'pending',
        createdBy: user,
      })
      .returning();

    // Jika langsung dikembalikan ke stok gudang:
    if (kembaliKeStok) {
      await db
        .update(inventory)
        .set({
          stok: sql`${inventory.stok} + ${parsedQty}`,
          updatedAt: new Date(),
        })
        .where(eq(inventory.sku, sku));
    }

    await db.insert(logs).values({
      user,
      aksi: 'RETUR_BARANG',
      detail: `Catat retur SKU ${sku} (${parsedQty} pcs) dari ${pelanggan || '-'}. Alasan: ${alasan || '-'}`,
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
