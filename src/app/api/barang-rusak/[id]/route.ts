import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangRusak, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { eq } from 'drizzle-orm';
import { BusinessError, errorResponse, incrementStock } from '@/shared/lib/stock';

// ============================================================
// API: /api/barang-rusak/[id]
// DELETE barang rusak & kembalikan stok
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
      const [item] = await tx.delete(barangRusak).where(eq(barangRusak.id, id)).returning();
      if (!item) throw new BusinessError('Data tidak ditemukan', 404);

      await incrementStock(tx, item.sku, item.qty, item.cabang);

      await tx.insert(logs).values({
        user,
        aksi: 'BATAL_BARANG_RUSAK',
        detail: `Membatalkan pencatatan rusak SKU: ${item.sku} (+${item.qty} pcs)`,
      });
    });

    return NextResponse.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (err) {
    return errorResponse(err, 'BARANG_RUSAK_DELETE');
  }
}
