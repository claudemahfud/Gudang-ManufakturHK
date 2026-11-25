import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { requireAuthRole, ROLES_FINANCE_SETORAN } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';
import { konfirmasiSetoran } from '@/shared/lib/setoran';

// POST /api/setoran/[id]/konfirmasi {jumlahDiterima}: Finance menerima setoran -> jurnal Dr Kas/Bank, Cr Kas di Tangan Sales
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthRole(ROLES_FINANCE_SETORAN);
    if (!auth.authorized) return auth.response;
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const diterima = body?.jumlahDiterima === undefined || body.jumlahDiterima === '' ? undefined : Number(body.jumlahDiterima);
    const username = String(auth.user?.username ?? '');
    const hasil = await db.transaction((tx) => konfirmasiSetoran(tx, id, diterima, { username, nama: String(auth.user?.name || username) }));
    return NextResponse.json({ success: true, data: hasil });
  } catch (err) {
    return errorResponse(err, 'SETORAN_KONFIRMASI');
  }
}
