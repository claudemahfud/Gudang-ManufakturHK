import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { canViewCostPrice, requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { resolveJatuhTempo } from '@/shared/lib/barang-masuk';
import { terimaFakturPo, type FakturItemInput } from '@/shared/lib/po-faktur';
import { BusinessError, errorResponse } from '@/shared/lib/stock';
import { keWebp } from '@/shared/lib/webp';

// ============================================================
// API: POST /api/po-loading/[id]/faktur
// "Barang Datang": PO dikonversi menjadi Faktur Pembelian.
// Qty & harga per barang bisa direvisi sesuai barang yang benar-benar diterima.
// Submit = barang_masuk tercatat + stok cabang PO bertambah + kas/hutang + status PO.
// ============================================================

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const body = await req.json();
    const tanggal = body.tanggal ? new Date(body.tanggal) : new Date();
    if (Number.isNaN(tanggal.getTime())) throw new BusinessError('Tanggal faktur tidak valid');
    const skemaBayar: 'lunas' | 'hutang' = body.skemaBayar === 'hutang' ? 'hutang' : 'lunas';

    const user = authResult.user?.name || authResult.user?.username || 'System';
    const diterimaOleh =
      typeof body.diterimaOleh === 'string' && body.diterimaOleh.trim() ? body.diterimaOleh.trim().slice(0, 100) : user;
    let fotoPenerimaan: string | null = null;
    if (typeof body.fotoPenerimaan === 'string' && body.fotoPenerimaan.trim()) {
      const f = body.fotoPenerimaan.trim();
      fotoPenerimaan = f.startsWith('data:application/pdf;')
        ? f
        : await keWebp(f, { lebar: 1400, tinggi: 1400, fit: 'inside', mutu: 78 });
    }

    const hasil = await db.transaction((tx) =>
      terimaFakturPo(tx, id, {
        items: Array.isArray(body.items) ? (body.items as FakturItemInput[]) : [],
        noFaktur: typeof body.noFaktur === 'string' && body.noFaktur.trim() ? body.noFaktur.trim() : null,
        tanggal,
        skemaBayar,
        jatuhTempo: resolveJatuhTempo(skemaBayar, tanggal, body.jatuhTempo),
        divisi: typeof body.divisi === 'string' && body.divisi ? body.divisi : 'MANUFAKTUR',
        user,
        diterimaOleh,
        fotoPenerimaan,
        bolehHpp: canViewCostPrice(authResult.userRole),
      })
    );

    return NextResponse.json({ success: true, data: hasil }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'PO_FAKTUR_POST');
  }
}
