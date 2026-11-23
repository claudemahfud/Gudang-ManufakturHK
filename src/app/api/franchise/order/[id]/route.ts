import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { requireAuthRole, ROLES_FRANCHISE_ORDER } from '@/shared/lib/auth/rbac';
import { BusinessError, errorResponse } from '@/shared/lib/stock';
import { batalOrder, kirimOrder, terimaOrder } from '@/shared/lib/order-franchise';

// ============================================================
// API: /api/franchise/order/[id]
// POST = { aksi: 'kirim', tempoHari? } (Dapur Pusat)
//      | { aksi: 'terima' }            (outlet franchise / pusat)
//      | { aksi: 'batal', alasan? }    (tolak oleh pusat / batal oleh franchise)
// ============================================================

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthRole(ROLES_FRANCHISE_ORDER);
    if (!auth.authorized) return auth.response;
    const { id } = await params;
    const body = await req.json();

    const hasil = await db.transaction((tx) => {
      switch (body?.aksi) {
        case 'kirim':
          return kirimOrder(tx, id, auth.user, body?.tempoHari === undefined ? undefined : Number(body.tempoHari));
        case 'terima':
          return terimaOrder(tx, id, auth.user);
        case 'batal':
          return batalOrder(tx, id, auth.user, typeof body?.alasan === 'string' ? body.alasan : '');
        default:
          throw new BusinessError('Aksi tidak dikenal');
      }
    });
    return NextResponse.json({ success: true, data: hasil, message: `Order ${hasil.noOrder}: ${hasil.status}` });
  } catch (err) {
    return errorResponse(err, 'ORDER_FRANCHISE_AKSI');
  }
}
