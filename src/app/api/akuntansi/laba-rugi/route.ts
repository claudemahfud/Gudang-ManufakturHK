import { NextResponse } from 'next/server';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';
import { entitasDari } from '@/shared/lib/jurnal';
import { hariIniWib, tanggalQuery } from '@/shared/lib/laporan-keuangan';
import { labaRugi } from '@/shared/lib/laporan-keuangan';

// GET /api/akuntansi/laba-rugi?entitas=&dari=&sampai=
export async function GET(req: Request) {
  try {
    const auth = await requireAuthRole(ROLES_PEMBUKUAN);
    if (!auth.authorized) return auth.response;
    const q = new URL(req.url).searchParams;
    const hari = hariIniWib();
    const data = await labaRugi(entitasDari(q.get('entitas')), tanggalQuery(q.get('dari'), `${hari.slice(0, 8)}01`), tanggalQuery(q.get('sampai'), hari));
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err, 'LABA_RUGI_GET');
  }
}
