import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangMasuk, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { eq } from 'drizzle-orm';
import { BusinessError, decrementStock, errorResponse } from '@/shared/lib/stock';

// ============================================================
// API: /api/barang-masuk/[id]
// DELETE barang masuk & rollback stok inventory
// Hak Akses: Divisi Gudang & Eksekutif
// ============================================================

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const user = authResult.user?.name || authResult.user?.username || 'System';

    await db.transaction(async (tx) => {
      // Hapus & ambil barisnya dalam satu langkah (aman dari klik ganda)
      const [item] = await tx.delete(barangMasuk).where(eq(barangMasuk.id, id)).returning();
      if (!item) throw new BusinessError('Data barang masuk tidak ditemukan', 404);

      // Rollback stok; ditolak bila barangnya sudah terjual/terpakai
      try {
        await decrementStock(tx, item.sku, item.qty);
      } catch (e) {
        if (e instanceof BusinessError && e.status === 400) {
          throw new BusinessError(
            `Barang masuk tidak bisa dihapus: sebagian stok ${item.sku} sudah keluar. ${e.message}`
          );
        }
        throw e;
      }

      await tx.insert(logs).values({
        user,
        aksi: 'HAPUS_BARANG_MASUK',
        detail: `Menghapus barang masuk ID: ${id}, SKU: ${item.sku} (${item.qty} ${item.satuan})`,
      });
    });

    return NextResponse.json({ success: true, message: 'Data barang masuk berhasil dihapus' });
  } catch (err) {
    return errorResponse(err, 'BARANG_MASUK_DELETE');
  }
}
