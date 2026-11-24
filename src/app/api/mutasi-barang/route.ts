import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { mutasiBarang, masterCabang, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { desc, inArray } from 'drizzle-orm';
import {
  decrementStock,
  errorResponse,
  incrementStock,
  normalizeSku,
  parsePositiveInt,
  resolveCabang,
} from '@/shared/lib/stock';

// ============================================================
// API: /api/mutasi-barang
// GET (list mutasi) + POST (pindahkan stok antar cabang)
// dari / ke = nama cabang di master_cabang.
// ============================================================

export async function GET() {
  try {
    // Dibaca segar dari DB: akun nonaktif/dihapus langsung ditolak walau token masih berlaku
    const authResult = await requireAuthRole();
    if (!authResult.authorized) return authResult.response;

    const items = await db
      .select()
      .from(mutasiBarang)
      .orderBy(desc(mutasiBarang.tanggal))
      .limit(100);

    return NextResponse.json({ success: true, data: items });
  } catch (err) {
    return errorResponse(err, 'MUTASI_GET');
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;

    const body = await req.json();
    const { tanggal, keterangan } = body;
    const sku = normalizeSku(body.sku);
    const qty = parsePositiveInt(body.qty);
    const dari = typeof body.dari === 'string' ? body.dari.trim() : '';
    const ke = typeof body.ke === 'string' ? body.ke.trim() : '';

    if (!sku || !dari || !ke) {
      return NextResponse.json(
        { success: false, message: 'SKU, Qty, Cabang asal, dan Cabang tujuan wajib diisi' },
        { status: 400 }
      );
    }
    if (!qty) {
      return NextResponse.json(
        { success: false, message: 'Qty harus bilangan bulat lebih dari 0' },
        { status: 400 }
      );
    }
    if (dari === ke) {
      return NextResponse.json(
        { success: false, message: 'Cabang asal dan tujuan tidak boleh sama' },
        { status: 400 }
      );
    }

    // Karyawan cabang hanya boleh mengirim dari cabangnya sendiri
    if (resolveCabang(authResult.user, dari) !== dari) {
      return NextResponse.json(
        { success: false, message: 'Anda hanya dapat memutasi stok dari cabang tempat Anda ditempatkan' },
        { status: 403 }
      );
    }

    const cabangValid = await db
      .select({ nama: masterCabang.namaCabang })
      .from(masterCabang)
      .where(inArray(masterCabang.namaCabang, [dari, ke]));
    if (cabangValid.length !== 2) {
      return NextResponse.json(
        { success: false, message: 'Cabang asal / tujuan tidak terdaftar di Manajemen Cabang' },
        { status: 400 }
      );
    }

    const user = authResult.user?.name || authResult.user?.username || 'System';

    // Kurangi stok asal & tambah stok tujuan dalam satu transaksi
    const row = await db.transaction(async (tx) => {
      const inv = await decrementStock(tx, sku, qty, dari);
      await incrementStock(tx, sku, qty, ke);

      const [inserted] = await tx
        .insert(mutasiBarang)
        .values({
          tanggal: tanggal ? new Date(tanggal) : new Date(),
          sku,
          namaBarang: inv.namaBarang,
          qty,
          dari,
          ke,
          divisi: body.divisi || 'MANUFAKTUR',
          cabang: dari,
          keterangan: keterangan || null,
          createdBy: user,
        })
        .returning();

      await tx.insert(logs).values({
        user,
        aksi: 'MUTASI_BARANG',
        detail: `Mutasi SKU ${sku} (${qty} pcs) dari cabang [${dari}] ke [${ke}]`,
      });

      return inserted;
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'MUTASI_POST');
  }
}
