import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';
import { barisReturFaktur, daftarFakturRetur } from '@/shared/lib/retur-pelanggan';

// GET /api/retur-pelanggan?q=...        -> faktur penjualan yang bisa jadi asal retur
// GET /api/retur-pelanggan?noFaktur=... -> baris faktur: qty terjual, sudah diretur, nilai per pcs
export async function GET(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(req.url);
    const noFaktur = searchParams.get('noFaktur');
    if (noFaktur) {
      const { faktur, baris } = await barisReturFaktur(db, noFaktur);
      return NextResponse.json({
        success: true,
        data: {
          faktur: {
            noFaktur: faktur.noFaktur,
            tanggal: faktur.tanggal,
            pelanggan: faktur.pelanggan,
            grandTotal: faktur.grandTotal,
            dibayar: faktur.dibayar,
            sisaPiutang: faktur.sisaPiutang,
            cabang: faktur.cabang,
            divisi: faktur.divisi,
          },
          baris,
        },
      });
    }
    return NextResponse.json({ success: true, data: await daftarFakturRetur(db, searchParams.get('q')) });
  } catch (err) {
    return errorResponse(err, 'RETUR_PELANGGAN_GET');
  }
}
