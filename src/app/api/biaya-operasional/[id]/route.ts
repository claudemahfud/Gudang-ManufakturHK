import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { requireAuthRole } from '@/shared/lib/auth/rbac';
import { BusinessError, errorResponse } from '@/shared/lib/stock';
import { batalPengajuan, batalkanDisetujui, reimburseBiaya, setujuiBiaya, tolakBiaya } from '@/shared/lib/biaya';

const UUID = /^[0-9a-f-]{36}$/i;

// DELETE: pengaju membatalkan biayanya selama masih menunggu
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthRole();
    if (!auth.authorized) return auth.response;
    const { id } = await params;
    if (!UUID.test(id)) throw new BusinessError('Biaya tidak ditemukan', 404);
    const user = { username: String(auth.user?.username ?? ''), nama: String(auth.user?.name || auth.user?.username) };
    await db.transaction((tx) => batalPengajuan(tx, id, user));
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err, 'BIAYA_BATAL');
  }
}

// POST {aksi: 'setujui'|'tolak'|'batalkan'|'reimburse', notaFisik, alasan, metode, foto}
// Hak memproses (Finance Pusat) dicek di dalam setiap fungsi.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthRole();
    if (!auth.authorized) return auth.response;
    const { id } = await params;
    if (!UUID.test(id)) throw new BusinessError('Biaya tidak ditemukan', 404);
    const body = await req.json().catch(() => ({}));
    const user = { username: String(auth.user?.username ?? ''), nama: String(auth.user?.name || auth.user?.username) };
    await db.transaction(async (tx) => {
      if (body.aksi === 'setujui') return setujuiBiaya(tx, id, body.notaFisik === true, user);
      if (body.aksi === 'tolak') return tolakBiaya(tx, id, String(body.alasan ?? ''), user);
      if (body.aksi === 'batalkan') return batalkanDisetujui(tx, id, String(body.alasan ?? ''), user);
      if (body.aksi === 'reimburse') return reimburseBiaya(tx, id, body.metode, body.foto, user);
      throw new BusinessError('Aksi tidak dikenal');
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err, 'BIAYA_PROSES');
  }
}
