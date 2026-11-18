import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { mutasiBarang, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { eq } from 'drizzle-orm';

// ============================================================
// API: /api/mutasi-barang/[id]
// DELETE mutasi barang
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

    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';
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
