import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { returBarang, inventory, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import type { UserRole } from '@/shared/types';
import { desc, eq } from 'drizzle-orm';
import { BusinessError, errorResponse, incrementStock, normalizeSku, parsePositiveInt } from '@/shared/lib/stock';

// ============================================================
// API: /api/retur-barang
// GET (list retur) + POST (catat pengajuan retur)
// ============================================================

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const items = await db
      .select()
      .from(returBarang)
      .orderBy(desc(returBarang.tanggal))
      .limit(100);

    return NextResponse.json({ success: true, data: items });
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
    const { tanggal, sku, namaBarang, qty, alasan, pelanggan, kembaliKeStok } = body;

    if (!sku || !qty) {
      return NextResponse.json(
        { success: false, message: 'SKU dan Qty wajib diisi' },
        { status: 400 }
      );
    }

    const parsedQty = parsePositiveInt(qty);
    const normalizedSku = normalizeSku(sku);
    if (!parsedQty || !normalizedSku) {
      return NextResponse.json(
        { success: false, message: 'Qty harus berupa bilangan bulat lebih dari 0' },
        { status: 400 }
      );
    }

    const sessionUser = session.user as { name?: string; username?: string; role?: UserRole };
    const user = sessionUser?.name || sessionUser?.username || 'System';

    // Langsung masuk stok = persetujuan retur, hanya untuk tim gudang
    if (kembaliKeStok && !ROLES_WAREHOUSE.includes(sessionUser?.role as UserRole)) {
      return NextResponse.json(
        { success: false, message: 'Hanya tim gudang yang boleh langsung mengembalikan retur ke stok.' },
        { status: 403 }
      );
    }

    const row = await db.transaction(async (tx) => {
      const [inv] = await tx
        .select({ namaBarang: inventory.namaBarang })
        .from(inventory)
        .where(eq(inventory.sku, normalizedSku))
        .limit(1);
      if (!inv) throw new BusinessError(`Barang dengan SKU ${normalizedSku} tidak ditemukan`, 404);

      const [inserted] = await tx
        .insert(returBarang)
        .values({
          tanggal: tanggal ? new Date(tanggal) : new Date(),
          sku: normalizedSku,
          namaBarang: inv.namaBarang || namaBarang,
          qty: parsedQty,
          alasan: alasan || null,
          pelanggan: pelanggan || null,
          status: kembaliKeStok ? 'disetujui' : 'pending',
          createdBy: user,
        })
        .returning();

      // Jika langsung dikembalikan ke stok gudang:
      if (kembaliKeStok) {
        await incrementStock(tx, normalizedSku, parsedQty);
      }

      await tx.insert(logs).values({
        user,
        aksi: 'RETUR_BARANG',
        detail: `Catat retur SKU ${normalizedSku} (${parsedQty} pcs) dari ${pelanggan || '-'}. Alasan: ${alasan || '-'}`,
      });

      return inserted;
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'RETUR_POST');
  }
}
