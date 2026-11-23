import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { requireAuthRole, ROLES_FRANCHISE_ORDER } from '@/shared/lib/auth/rbac';
import { BusinessError, errorResponse } from '@/shared/lib/stock';
import { buatOrder, daftarOrder, franchiseTerlihat, katalogFranchise } from '@/shared/lib/order-franchise';

// ============================================================
// API: /api/franchise/order — Order Franchise ke Dapur Pusat
// GET  = daftar order (franchise: hanya outletnya) + katalog produk
// POST = { franchise?, items: [{ sku, qty }], catatan? }
//        franchise diambil dari akun outlet; tim pusat boleh memesan atas nama outlet.
// ============================================================

export async function GET() {
  try {
    const auth = await requireAuthRole(ROLES_FRANCHISE_ORDER);
    if (!auth.authorized) return auth.response;
    const [order, katalog] = await Promise.all([daftarOrder(auth.user), katalogFranchise()]);
    return NextResponse.json({ success: true, data: order, katalog, lingkup: franchiseTerlihat(auth.user) });
  } catch (err) {
    return errorResponse(err, 'ORDER_FRANCHISE_GET');
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthRole(ROLES_FRANCHISE_ORDER);
    if (!auth.authorized) return auth.response;
    const body = await req.json();
    const franchise = franchiseTerlihat(auth.user) ?? (typeof body?.franchise === 'string' ? body.franchise.trim() : '');
    if (!franchise) throw new BusinessError('Pilih outlet franchise pemesan');

    const order = await db.transaction((tx) =>
      buatOrder(
        tx,
        {
          franchise,
          items: Array.isArray(body?.items) ? body.items : [],
          catatan: typeof body?.catatan === 'string' && body.catatan.trim() ? body.catatan.trim() : null,
        },
        auth.user
      )
    );
    return NextResponse.json({ success: true, data: order, message: `Order ${order.noOrder} terkirim ke Dapur Pusat` });
  } catch (err) {
    return errorResponse(err, 'ORDER_FRANCHISE_POST');
  }
}
