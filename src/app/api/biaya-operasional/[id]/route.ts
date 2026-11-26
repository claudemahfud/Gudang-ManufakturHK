import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { biayaOperasional, keuangan, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { eq } from 'drizzle-orm';
import { balikJurnal } from '@/shared/lib/jurnal';
import { BusinessError, errorResponse } from '@/shared/lib/stock';

// Hapus biaya: kas keluarnya dihapus & jurnalnya dibalik (jejak tetap ada di buku besar)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthRole(ROLES_PEMBUKUAN);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const user = authResult.user?.name || authResult.user?.username || 'System';

    await db.transaction(async (tx) => {
      const [row] = await tx.delete(biayaOperasional).where(eq(biayaOperasional.id, id)).returning();
      if (!row) throw new BusinessError('Biaya operasional tidak ditemukan', 404);
      // melempar di dalam transaksi = penghapusan di atas dibatalkan
      if (row.setoranId) throw new BusinessError('Biaya ini bagian dari setoran penjual yang sudah dikonfirmasi, tidak bisa dihapus terpisah');
      if (row.keuanganId) await tx.delete(keuangan).where(eq(keuangan.id, row.keuanganId));
      await balikJurnal(tx, { referensi: row.id, sumber: ['BIAYA'], keterangan: `Hapus biaya ${row.kategori}`, user });
      await tx.insert(logs).values({
        user,
        aksi: 'HAPUS_BIAYA_OPERASIONAL',
        detail: `Menghapus biaya ${row.kategori} Rp ${Number(row.jumlah).toLocaleString('id-ID')} (jurnal dibalik)`,
      });
    });

    return NextResponse.json({ success: true, message: 'Biaya operasional dihapus' });
  } catch (err) {
    return errorResponse(err, 'BIAYA_DELETE');
  }
}
