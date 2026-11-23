import { NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { inventory } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_RECIPE_BOM } from '@/shared/lib/auth/rbac';
import { BusinessError, errorResponse, normalizeSku } from '@/shared/lib/stock';
import { ambilResep, ringkasanResep, simpanResep } from '@/shared/lib/dapur-pusat';
import { isTimPusat } from '@/shared/lib/order-franchise';

// ============================================================
// API: /api/fnb/hpp — Master Resep & HPP Dapur Pusat
// GET            = ringkasan semua produk F&B + daftar bahan
// GET ?sku=X     = resep lengkap satu produk
// PUT            = simpan resep { menuSku, hasilQty, catatan, bahan[], biaya[], hargaFranchise, hargaJual }
// Hanya tim Dapur Pusat (HPP rahasia, franchise tidak boleh melihat).
// ============================================================

async function izin() {
  const auth = await requireAuthRole(ROLES_RECIPE_BOM);
  if (!auth.authorized) return { auth, tolak: auth.response };
  if (!isTimPusat(auth.user)) {
    return {
      auth,
      tolak: NextResponse.json({ success: false, message: 'Master Resep hanya untuk tim Dapur Pusat' }, { status: 403 }),
    };
  }
  return { auth, tolak: null };
}

export async function GET(req: Request) {
  try {
    const { tolak } = await izin();
    if (tolak) return tolak;

    const sku = normalizeSku(new URL(req.url).searchParams.get('sku'));
    if (sku) {
      const resep = await ambilResep(db, sku);
      if (!resep) throw new BusinessError('Produk tidak ditemukan', 404);
      return NextResponse.json({ success: true, data: resep });
    }

    const [produk, bahan] = await Promise.all([
      ringkasanResep(),
      db
        .select({
          sku: inventory.sku,
          namaBarang: inventory.namaBarang,
          tipeItem: inventory.tipeItem,
          hargaBeli: inventory.hargaBeli,
        })
        .from(inventory)
        .where(and(eq(inventory.divisi, 'FNB'), ne(inventory.tipeItem, 'menu_olahan')))
        .orderBy(inventory.namaBarang),
    ]);
    return NextResponse.json({
      success: true,
      data: produk,
      bahan: bahan.map((b) => ({ ...b, hargaBeli: Number(b.hargaBeli ?? 0) })),
    });
  } catch (err) {
    return errorResponse(err, 'RESEP_GET');
  }
}

export async function PUT(req: Request) {
  try {
    const { auth, tolak } = await izin();
    if (tolak) return tolak;
    const body = await req.json();

    const resep = await db.transaction((tx) =>
      simpanResep(
        tx,
        {
          menuSku: String(body?.menuSku ?? ''),
          hasilQty: Number(body?.hasilQty),
          catatan: typeof body?.catatan === 'string' && body.catatan.trim() ? body.catatan.trim() : null,
          bahan: Array.isArray(body?.bahan) ? body.bahan : [],
          biaya: Array.isArray(body?.biaya) ? body.biaya : [],
          hargaFranchise: Number(body?.hargaFranchise ?? 0),
          hargaJual: Number(body?.hargaJual ?? 0),
        },
        auth.user.username
      )
    );
    return NextResponse.json({ success: true, data: resep, message: 'Resep tersimpan' });
  } catch (err) {
    return errorResponse(err, 'RESEP_SIMPAN');
  }
}
