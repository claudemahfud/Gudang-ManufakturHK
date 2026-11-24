import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { keuangan, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { eq } from 'drizzle-orm';
import { balikJurnal } from '@/shared/lib/jurnal';
import { BusinessError, errorResponse } from '@/shared/lib/stock';

// Hapus kas manual saja; kas otomatis dibatalkan lewat transaksi asalnya (faktur, POS, pembelian, ...)
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
      const [row] = await tx.select().from(keuangan).where(eq(keuangan.id, id)).for('update').limit(1);
      if (!row) throw new BusinessError('Data keuangan tidak ditemukan', 404);
      if (!row.akunKode) {
        throw new BusinessError('Kas ini dicatat otomatis dari transaksi. Batalkan lewat transaksi asalnya.');
      }
      await balikJurnal(tx, { referensi: row.id, sumber: ['KAS_MANUAL'], keterangan: `Hapus kas manual ${row.kategori}`, user });
      await tx.delete(keuangan).where(eq(keuangan.id, id));
      await tx.insert(logs).values({
        user,
        aksi: 'HAPUS_KEUANGAN',
        detail: `Menghapus kas manual ${row.jenis} ${row.kategori} Rp ${Number(row.jumlah).toLocaleString('id-ID')} (jurnal dibalik)`,
      });
    });

    return NextResponse.json({ success: true, message: 'Data keuangan berhasil dihapus' });
  } catch (err) {
    return errorResponse(err, 'KEUANGAN_DELETE');
  }
}
