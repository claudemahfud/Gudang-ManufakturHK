import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { mutasiBarang, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { eq } from 'drizzle-orm';

// ============================================================
// API: /api/mutasi-barang/[id]
// DELETE mutasi barang
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

    const [item] = await db
      .select()
      .from(mutasiBarang)
      .where(eq(mutasiBarang.id, id))
      .limit(1);

    if (!item) {
      return NextResponse.json(
        { success: false, message: 'Data tidak ditemukan' },
        { status: 404 }
      );
    }

    await db.delete(mutasiBarang).where(eq(mutasiBarang.id, id));

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'HAPUS_MUTASI',
      detail: `Menghapus riwayat mutasi ID: ${id} SKU: ${item.sku}`,
    });

    return NextResponse.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
