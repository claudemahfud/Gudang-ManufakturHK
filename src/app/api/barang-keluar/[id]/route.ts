import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangKeluar, inventory, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { eq, sql } from 'drizzle-orm';

// ============================================================
// API: /api/barang-keluar/[id]
// DELETE barang keluar & rollback stok inventory
// ============================================================

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [item] = await db
      .select()
      .from(barangKeluar)
      .where(eq(barangKeluar.id, id))
      .limit(1);

    if (!item) {
      return NextResponse.json(
        { success: false, message: 'Data pengeluaran tidak ditemukan' },
        { status: 404 }
      );
    }

    // Rollback stok inventory (+ qty)
    await db
      .update(inventory)
      .set({
        stok: sql`${inventory.stok} + ${item.qty}`,
        updatedAt: new Date(),
      })
      .where(eq(inventory.sku, item.sku));

    // Hapus baris pengeluaran
    await db.delete(barangKeluar).where(eq(barangKeluar.id, id));

    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'BATAL_BARANG_KELUAR',
      detail: `Membatalkan item ${item.sku} dari transaksi ${item.trxId}`,
    });

    return NextResponse.json({ success: true, message: 'Data berhasil dihapus dan stok dikembalikan' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
