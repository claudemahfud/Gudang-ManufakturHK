import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangKeluar } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { eq } from 'drizzle-orm';

// ============================================================
// API: /api/barang-keluar/invoice/[trxId]
// GET data invoice untuk cetak surat jalan / invoice
// ============================================================

export async function GET(
  req: Request,
  { params }: { params: Promise<{ trxId: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { trxId } = await params;

    const items = await db
      .select()
      .from(barangKeluar)
      .where(eq(barangKeluar.trxId, trxId));

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Faktur / Transaksi tidak ditemukan' },
        { status: 404 }
      );
    }

    const first = items[0];
    const totalSemua = items.reduce((acc, curr) => acc + parseFloat(curr.total || '0'), 0);

    return NextResponse.json({
      success: true,
      data: {
        trxId: first.trxId,
        tanggal: first.tanggal,
        pelanggan: first.pelanggan,
        salesman: first.salesman,
        createdBy: first.createdBy,
        total: totalSemua,
        items: items.map((i) => ({
          sku: i.sku,
          namaBarang: i.namaBarang,
          qty: i.qty,
          satuan: i.satuan,
          hargaJual: i.hargaJual,
          diskon: i.diskon,
          total: i.total,
        })),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
