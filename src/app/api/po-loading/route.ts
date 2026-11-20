import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { poLoading, poLoadingItems, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { generateTrxId } from '@/shared/lib/utils';
import { desc, eq } from 'drizzle-orm';

// ============================================================
// API: /api/po-loading
// GET (list PO) + POST (buat PO Loading & items)
// ============================================================

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const list = await db
      .select()
      .from(poLoading)
      .orderBy(desc(poLoading.createdAt))
      .limit(100);

    return NextResponse.json({ success: true, data: list });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tanggal, supplier, armada, catatan, items } = body;

    if (!supplier || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Supplier dan daftar order barang wajib diisi' },
        { status: 400 }
      );
    }

    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';
    const noPo = generateTrxId('PO');
    let headerResult: any;

    await db.transaction(async (tx) => {
      const [header] = await tx
        .insert(poLoading)
        .values({
          noPo,
          tanggal: tanggal ? new Date(tanggal) : new Date(),
          supplier,
          armada: armada || null,
          status: 'dipesan',
          catatan: catatan || null,
          createdBy: user,
        })
        .returning();

      headerResult = header;

      for (const it of items) {
        await tx.insert(poLoadingItems).values({
          poLoadingId: header.id,
          sku: it.sku,
          namaBarang: it.namaBarang,
          qtyOrder: parseInt(it.qtyOrder, 10) || 1,
          qtyTerima: 0,
          satuan: it.satuan || 'pcs',
        });
      }

      await tx.insert(logs).values({
        user,
        aksi: 'BUAT_PO_LOADING',
        detail: `Menerbitkan ${noPo} ke supplier ${supplier}`,
      });
    });

    return NextResponse.json({ success: true, data: headerResult }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
