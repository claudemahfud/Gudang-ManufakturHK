import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangRusak, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { desc } from 'drizzle-orm';
import { decrementStock, errorResponse, normalizeSku, resolveRequestCabang } from '@/shared/lib/stock';

// ============================================================
// API: /api/barang-rusak
// GET (list barang rusak) + POST (catat barang rusak & potong stok)
// ============================================================

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const divisi = searchParams.get('divisi');

    let items = await db
      .select()
      .from(barangRusak)
      .orderBy(desc(barangRusak.tanggal))
      .limit(100);

    if (divisi && divisi !== 'SEMUA') {
      items = items.filter((item: any) => !item.divisi || item.divisi === divisi);
    }

    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;

    const body = await req.json();
    const { tanggal, sku, namaBarang, qty, keterangan, divisi = 'MANUFAKTUR' } = body;

    if (!sku || !qty) {
      return NextResponse.json(
        { success: false, message: 'SKU dan Qty wajib diisi' },
        { status: 400 }
      );
    }

    const parsedQty = parseInt(qty, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return NextResponse.json(
        { success: false, message: 'Qty harus berupa angka lebih dari 0' },
        { status: 400 }
      );
    }

    const normalizedSku = normalizeSku(sku);
    const user = authResult.user?.name || authResult.user?.username || 'System';
    const cabang = await resolveRequestCabang(authResult.user, body.cabang);

    // Potong stok, catat, dan log dalam satu transaksi atomik
    const row = await db.transaction(async (tx) => {
      const inv = await decrementStock(tx, normalizedSku, parsedQty, cabang);

      const [inserted] = await tx
        .insert(barangRusak)
        .values({
          tanggal: tanggal ? new Date(tanggal) : new Date(),
          sku: normalizedSku,
          namaBarang: inv.namaBarang || namaBarang,
          qty: parsedQty,
          divisi,
          cabang,
          keterangan: keterangan || null,
          createdBy: user,
        })
        .returning();

      await tx.insert(logs).values({
        user,
        aksi: 'BARANG_RUSAK',
        detail: `Mencatat barang rusak SKU: ${normalizedSku} (-${parsedQty} pcs) [${cabang}]. Ket: ${keterangan || '-'}`,
      });

      return inserted;
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'BARANG_RUSAK_POST');
  }
}
