import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { requireAuthRole, ROLES_FINANCE_SETORAN, ROLES_PENYETOR } from '@/shared/lib/auth/rbac';
import { punyaRole } from '@/shared/lib/auth/roles';
import { errorResponse } from '@/shared/lib/stock';
import { rincianKasSales } from '@/shared/lib/setoran';

// GET /api/setoran/rincian?divisi=&sales= : mutasi kas di tangan sales. Sales hanya miliknya sendiri.
export async function GET(req: Request) {
  try {
    const auth = await requireAuthRole([...ROLES_PENYETOR, ...ROLES_FINANCE_SETORAN]);
    if (!auth.authorized) return auth.response;
    const q = new URL(req.url).searchParams;
    const username = String(auth.user?.username ?? '');
    const sales = q.get('sales') || username;
    if (sales !== username && !punyaRole(auth.user, ROLES_FINANCE_SETORAN)) {
      return NextResponse.json({ success: false, message: 'Anda hanya bisa melihat rincian kas sendiri' }, { status: 403 });
    }
    const data = await rincianKasSales(db, q.get('divisi') === 'FNB' ? 'FNB' : 'MANUFAKTUR', sales);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err, 'SETORAN_RINCIAN');
  }
}
