import { NextResponse } from 'next/server';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';
import { entitasDari } from '@/shared/lib/jurnal';
import { hariIniWib, tanggalQuery } from '@/shared/lib/laporan-keuangan';
import { bukuBesar } from '@/shared/lib/laporan-keuangan';

// GET /api/akuntansi/buku-besar?entitas=&akun=&dari=&sampai=
export async function GET(req: Request) {
  try {
    const auth = await requireAuthRole(ROLES_PEMBUKUAN);
    if (!auth.authorized) return auth.response;
    const q = new URL(req.url).searchParams;
    const hari = hariIniWib();
    const data = await bukuBesar(
      entitasDari(q.get('entitas')),
      String(q.get('akun') || ''),
      tanggalQuery(q.get('dari'), `${hari.slice(0, 8)}01`),
      tanggalQuery(q.get('sampai'), hari)
    );
    if (!data) return NextResponse.json({ success: false, message: 'Akun tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err, 'BUKU_BESAR_GET');
  }
}
