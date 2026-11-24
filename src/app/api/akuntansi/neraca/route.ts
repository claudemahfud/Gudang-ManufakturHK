import { NextResponse } from 'next/server';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';
import { entitasDari } from '@/shared/lib/jurnal';
import { hariIniWib, tanggalQuery } from '@/shared/lib/laporan-keuangan';
import { neraca } from '@/shared/lib/laporan-keuangan';

// GET /api/akuntansi/neraca?entitas=MANUFAKTUR|FNB&per=YYYY-MM-DD
export async function GET(req: Request) {
  try {
    const auth = await requireAuthRole(ROLES_PEMBUKUAN);
    if (!auth.authorized) return auth.response;
    const q = new URL(req.url).searchParams;
    const data = await neraca(entitasDari(q.get('entitas')), tanggalQuery(q.get('per'), hariIniWib()));
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err, 'NERACA_GET');
  }
}
