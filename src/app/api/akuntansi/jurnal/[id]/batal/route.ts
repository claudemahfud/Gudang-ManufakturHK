import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { jurnal, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { BusinessError, errorResponse } from '@/shared/lib/stock';
import { balikSatuJurnal } from '@/shared/lib/jurnal';

// POST /api/akuntansi/jurnal/[id]/batal {alasan}: batalkan jurnal MANUAL lewat jurnal pembalik.
// Jurnal otomatis dibatalkan lewat transaksi asalnya agar dokumen & buku tetap sinkron.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthRole(ROLES_PEMBUKUAN);
    if (!auth.authorized) return auth.response;
    const user = auth.user?.name || auth.user?.username || 'System';
    const { id } = await params;
    const { alasan } = await req.json().catch(() => ({ alasan: '' }));
    if (!String(alasan || '').trim()) throw new BusinessError('Alasan pembatalan wajib diisi');

    await db.transaction(async (tx) => {
      const [h] = await tx.select().from(jurnal).where(eq(jurnal.id, id)).limit(1);
      if (!h) throw new BusinessError('Jurnal tidak ditemukan', 404);
      if (h.sumber !== 'MANUAL') throw new BusinessError('Hanya jurnal manual yang bisa dibatalkan di sini. Batalkan transaksi asalnya.');
      await balikSatuJurnal(tx, id, String(alasan).trim(), user);
      await tx.insert(logs).values({ user, aksi: 'BATAL_JURNAL', detail: `Batalkan jurnal ${h.noJurnal}: ${String(alasan).trim()}` });
    });
    return NextResponse.json({ success: true, message: 'Jurnal dibatalkan dengan jurnal pembalik' });
  } catch (err) {
    return errorResponse(err, 'JURNAL_BATAL');
  }
}
