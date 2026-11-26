import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { requireAuthRole, ROLES_FINANCE_SETORAN } from '@/shared/lib/auth/rbac';
import { BusinessError, errorResponse } from '@/shared/lib/stock';
import { daftarTransferSales, verifikasiTransfer } from '@/shared/lib/verifikasi-transfer';

// GET  /api/verifikasi-transfer?divisi=&status=belum|semua : penerimaan Bank/QRIS yang dicatat sales
// POST {divisi, referensi, akun, sales, hasil: cocok|tidak_ditemukan, catatan}
export async function GET(req: Request) {
  try {
    const auth = await requireAuthRole(ROLES_FINANCE_SETORAN);
    if (!auth.authorized) return auth.response;
    const q = new URL(req.url).searchParams;
    const data = await daftarTransferSales(db, q.get('divisi') || 'MANUFAKTUR', { status: q.get('status') === 'semua' ? 'semua' : 'belum' });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err, 'VERIFIKASI_GET');
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthRole(ROLES_FINANCE_SETORAN);
    if (!auth.authorized) return auth.response;
    const b = await req.json();
    if (b.hasil !== 'cocok' && b.hasil !== 'tidak_ditemukan') throw new BusinessError('Hasil verifikasi tidak valid');
    if (!b.referensi || !b.akun || !b.sales) throw new BusinessError('Data transfer tidak lengkap');
    const username = String(auth.user?.username ?? '');
    const data = await db.transaction((tx) =>
      verifikasiTransfer(
        tx,
        {
          divisi: b.divisi === 'FNB' ? 'FNB' : 'MANUFAKTUR',
          referensi: String(b.referensi),
          akun: String(b.akun),
          sales: String(b.sales),
          hasil: b.hasil,
          catatan: b.catatan ? String(b.catatan) : null,
        },
        { username, nama: String(auth.user?.name || username) }
      )
    );
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err, 'VERIFIKASI_POST');
  }
}
