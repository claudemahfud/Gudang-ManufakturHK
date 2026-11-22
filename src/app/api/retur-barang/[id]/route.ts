import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { returBarang, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { and, eq, ne } from 'drizzle-orm';
import { BusinessError, decrementStock, errorResponse, incrementStock } from '@/shared/lib/stock';

// ============================================================
// API: /api/retur-barang/[id]
// PUT (approve retur & tambah ke stok) + DELETE
// Hak Akses: Divisi Gudang & Eksekutif
// Status 'disetujui' = qty retur sudah masuk ke stok gudang.
// ============================================================

const ALLOWED_STATUS = ['pending', 'disetujui', 'ditolak'] as const;

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const { status, tambahKeStok } = await req.json();

    if (!ALLOWED_STATUS.includes(status)) {
      return NextResponse.json({ success: false, message: 'Status retur tidak valid' }, { status: 400 });
    }

    const user = authResult.user?.name || authResult.user?.username || 'System';

    const updatedResult = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(returBarang).where(eq(returBarang.id, id)).for('update').limit(1);
      if (!current) throw new BusinessError('Data tidak ditemukan', 404);

      // Retur yang sudah masuk stok tidak bisa diubah statusnya lewat sini
      // (hapus retur bila ingin membatalkan, stok akan ditarik kembali).
      if (current.status === 'disetujui') {
        if (status === 'disetujui') return current; // idempoten: klik ulang tidak menambah stok lagi
        throw new BusinessError('Retur sudah disetujui & masuk stok; hapus retur untuk membatalkan.');
      }

      const masukStok = status === 'disetujui';
      if (masukStok && !tambahKeStok) {
        throw new BusinessError('Persetujuan retur wajib menambahkan barang ke stok.');
      }

      const [updated] = await tx
        .update(returBarang)
        .set({ status })
        .where(and(eq(returBarang.id, id), ne(returBarang.status, 'disetujui')))
        .returning();
      if (!updated) throw new BusinessError('Retur sudah diproses oleh pengguna lain.', 409);

      if (masukStok) {
        await incrementStock(tx, current.sku, current.qty);
      }

      await tx.insert(logs).values({
        user,
        aksi: 'UPDATE_STATUS_RETUR',
        detail: `Update retur ID: ${id} status: ${current.status} -> ${status}${masukStok ? ` (+${current.qty} ke stok ${current.sku})` : ''}`,
      });

      return updated;
    });

    return NextResponse.json({ success: true, data: updatedResult });
  } catch (err) {
    return errorResponse(err, 'RETUR_PUT');
  }
}

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
      const [item] = await tx.delete(returBarang).where(eq(returBarang.id, id)).returning();
      if (!item) throw new BusinessError('Data tidak ditemukan', 404);

      // Retur yang sudah masuk stok: tarik kembali qty-nya
      if (item.status === 'disetujui') {
        await decrementStock(tx, item.sku, item.qty);
      }

      await tx.insert(logs).values({
        user,
        aksi: 'HAPUS_RETUR',
        detail: `Menghapus retur ID: ${id} SKU: ${item.sku}${item.status === 'disetujui' ? ` (-${item.qty} dari stok)` : ''}`,
      });
    });

    return NextResponse.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (err) {
    return errorResponse(err, 'RETUR_DELETE');
  }
}
