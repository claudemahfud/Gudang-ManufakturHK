import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangKeluar, inventory, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_EXECUTIVE } from '@/shared/lib/auth/rbac';
import { eq, sql } from 'drizzle-orm';

// ============================================================
// API: /api/barang-keluar/[id]
// DELETE barang keluar & rollback stok inventory
// Hak Akses: Administrator, Direktur Utama, Manager (Executive Anti-Fraud)
// ============================================================

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthRole(ROLES_EXECUTIVE);
    if (!authResult.authorized) return authResult.response;

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

    const user = authResult.user?.name || authResult.user?.username || 'System';

    await db.transaction(async (tx) => {
      // Rollback stok inventory (+ qty)
      await tx
        .update(inventory)
        .set({
          stok: sql`${inventory.stok} + ${item.qty}`,
          updatedAt: new Date(),
        })
        .where(eq(inventory.sku, item.sku));

      // Hapus baris pengeluaran
      await tx.delete(barangKeluar).where(eq(barangKeluar.id, id));

      await tx.insert(logs).values({
        user,
        aksi: 'BATAL_BARANG_KELUAR',
        detail: `Membatalkan item ${item.sku} (${item.qty} ${item.satuan}) dari transaksi ${item.trxId}`,
      });
    });

    return NextResponse.json({ success: true, message: 'Data berhasil dihapus dan stok dikembalikan' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
