import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { mutasiBarang, masterCabang, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { eq, inArray } from 'drizzle-orm';
import { BusinessError, decrementStock, errorResponse, incrementStock } from '@/shared/lib/stock';

// ============================================================
// API: /api/mutasi-barang/[id]
// DELETE mutasi barang = batalkan: stok kembali dari cabang tujuan ke asal
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
      const [item] = await tx.delete(mutasiBarang).where(eq(mutasiBarang.id, id)).returning();
      if (!item) throw new BusinessError('Data tidak ditemukan', 404);

      // Riwayat lama (lokasi rak, sebelum stok per cabang) tidak memindahkan stok
      const cabang = await tx
        .select({ nama: masterCabang.namaCabang })
        .from(masterCabang)
        .where(inArray(masterCabang.namaCabang, [item.dari, item.ke]));
      const pindahStok = item.dari !== item.ke && cabang.length === 2;

      if (pindahStok) {
        // Gagal bila stok di cabang tujuan sudah terpakai
        await decrementStock(tx, item.sku, item.qty, item.ke);
        await incrementStock(tx, item.sku, item.qty, item.dari);
      }

      await tx.insert(logs).values({
        user,
        aksi: 'HAPUS_MUTASI',
        detail: `Membatalkan mutasi ID: ${id} SKU: ${item.sku}${pindahStok ? ` (${item.qty} pcs kembali dari [${item.ke}] ke [${item.dari}])` : ''}`,
      });
    });

    return NextResponse.json({ success: true, message: 'Mutasi dibatalkan' });
  } catch (err) {
    return errorResponse(err, 'MUTASI_DELETE');
  }
}
