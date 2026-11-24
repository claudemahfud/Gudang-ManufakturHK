import { NextResponse } from 'next/server';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';
import { entitasDari } from '@/shared/lib/jurnal';
import { ringkasan } from '@/shared/lib/laporan-keuangan';

// GET /api/akuntansi/ringkasan?entitas=: kesehatan bisnis untuk dashboard pimpinan
export async function GET(req: Request) {
  try {
    const auth = await requireAuthRole(ROLES_PEMBUKUAN);
    if (!auth.authorized) return auth.response;
    const data = await ringkasan(entitasDari(new URL(req.url).searchParams.get('entitas')));
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err, 'RINGKASAN_GET');
  }
}
