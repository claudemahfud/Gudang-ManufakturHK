import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { poLoading, poLoadingItems, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { resolveRequestCabang } from '@/shared/lib/stock';
import { desc, inArray } from 'drizzle-orm';
import { PO_STATUS } from '@/shared/lib/po-status';
import { nomorUrut } from '@/shared/lib/nomor-urut';
import { normalizeSatuan } from '@/shared/lib/satuan';

// ============================================================
// API: /api/po-loading
// GET (list PO) + POST (buat PO Loading & items)
// ============================================================

export async function GET(req: Request) {
  try {
    // Dibaca segar dari DB: akun nonaktif/dihapus langsung ditolak walau token masih berlaku
    const authResult = await requireAuthRole();
    if (!authResult.authorized) return authResult.response;

    // ?terbuka=1: PO yang menunggu barang datang (untuk Barang Masuk), lengkap dengan item
    if (new URL(req.url).searchParams.get('terbuka') === '1') {
      const open = await db
        .select()
        .from(poLoading)
        .where(inArray(poLoading.status, [PO_STATUS.PROSES, PO_STATUS.SEBAGIAN]))
        .orderBy(desc(poLoading.tanggal))
        .limit(200);
      const items = open.length
        ? await db
            .select()
            .from(poLoadingItems)
            .where(inArray(poLoadingItems.poLoadingId, open.map((p) => p.id)))
        : [];
      const data = open.map((p) => ({ ...p, items: items.filter((it) => it.poLoadingId === p.id) }));
      return NextResponse.json({ success: true, data });
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
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;
    const session = { user: authResult.user };

    const body = await req.json();
    const { tanggal, supplier, armada, catatan, items } = body;

    if (!supplier || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Supplier dan daftar order barang wajib diisi' },
        { status: 400 }
      );
    }

    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';
    let noPo = '';
    const cabang = await resolveRequestCabang(session.user, body.cabang);
    let headerResult: any;

    await db.transaction(async (tx) => {
      noPo = await nomorUrut(tx, 'PO');
      const [header] = await tx
        .insert(poLoading)
        .values({
          noPo,
          tanggal: tanggal ? new Date(tanggal) : new Date(),
          supplier,
          armada: armada || null,
          status: PO_STATUS.PROSES,
          cabang,
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
          satuan: normalizeSatuan(it.satuan),
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
