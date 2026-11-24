import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { inventory, logs } from '@/shared/lib/db/schema';
import { eq } from 'drizzle-orm';
import { BusinessError } from '@/shared/lib/stock';
import {
  canViewCostPrice,
  requireAuthRole,
  ROLES_EXECUTIVE,
  ROLES_STOCK_ADJUST,
  ROLES_WAREHOUSE,
} from '@/shared/lib/auth/rbac';
import { punyaRole } from '@/shared/lib/auth/roles';

// ============================================================
// API ROUTE: Detail Item Inventory (Update & Delete)
// Endpoint:
// - PUT /api/inventory/[sku] (update item)
// - DELETE /api/inventory/[sku] (delete item)
// ============================================================

interface RouteParams {
  params: Promise<{ sku: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;
    const actor = authResult.user?.name || authResult.user?.username || 'System';

    const { sku } = await params;
    const decodedSku = decodeURIComponent(sku).trim().toUpperCase();

    // Pastikan item ada
    const [existing] = await db
      .select({
        id: inventory.id,
        sku: inventory.sku,
        hargaBeli: inventory.hargaBeli,
        hargaJual: inventory.hargaJual,
      })
      .from(inventory)
      .where(eq(inventory.sku, decodedSku))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Barang dengan SKU "${decodedSku}" tidak ditemukan` },
        { status: 404 }
      );
    }

    // Stok sengaja tidak dibaca: stok hanya berubah lewat Barang Masuk / Barang Keluar
    const body = await req.json();
    const {
      namaBarang,
      brand,
      gramasi,
      varian,
      hargaBeli,
      hargaBeliKarton,
      hargaJual,
      supplier,
      settingPcs,
      pakaiKarton,
      stokMinimum,
      keterangan,
    } = body;

    if (namaBarang !== undefined && !namaBarang.trim()) {
      return NextResponse.json(
        { success: false, error: 'Nama Barang tidak boleh kosong' },
        { status: 400 }
      );
    }


    // --- Harga jual: hanya pimpinan / Kepala Gudang ---
    const hargaJualBaru = hargaJual !== undefined ? Number(hargaJual) : undefined;
    if (hargaJualBaru !== undefined && (!Number.isFinite(hargaJualBaru) || hargaJualBaru < 0)) {
      return NextResponse.json({ success: false, error: 'Harga jual tidak valid' }, { status: 400 });
    }
    const hargaJualBerubah = hargaJualBaru !== undefined && hargaJualBaru !== Number(existing.hargaJual ?? 0);
    if (hargaJualBerubah && !punyaRole(authResult.user, ROLES_STOCK_ADJUST)) {
      return NextResponse.json(
        { success: false, error: 'Perubahan harga jual hanya untuk pimpinan / Kepala Gudang.' },
        { status: 403 }
      );
    }

    // --- Harga beli / HPP: hanya role yang boleh melihat HPP; lainnya diabaikan ---
    const hargaBeliBaru = hargaBeli !== undefined && canViewCostPrice(authResult.user) ? Number(hargaBeli) : undefined;
    if (hargaBeliBaru !== undefined && (!Number.isFinite(hargaBeliBaru) || hargaBeliBaru < 0)) {
      return NextResponse.json({ success: false, error: 'Harga beli tidak valid' }, { status: 400 });
    }
    const hargaKartonBaru =
      hargaBeliKarton !== undefined && canViewCostPrice(authResult.user) ? Number(hargaBeliKarton) : undefined;
    if (hargaKartonBaru !== undefined && (!Number.isFinite(hargaKartonBaru) || hargaKartonBaru < 0)) {
      return NextResponse.json({ success: false, error: 'Harga beli per karton tidak valid' }, { status: 400 });
    }

    const [updated] = await db
      .update(inventory)
      .set({
        ...(namaBarang !== undefined && { namaBarang: namaBarang.trim() }),
        ...(brand !== undefined && { brand: brand?.trim() || null }),
        ...(gramasi !== undefined && { gramasi: gramasi?.trim() || null }),
        ...(varian !== undefined && { varian: varian?.trim() || null }),
        ...(hargaBeliBaru !== undefined && { hargaBeli: String(hargaBeliBaru) }),
        ...(hargaKartonBaru !== undefined && { hargaBeliKarton: String(hargaKartonBaru) }),
        ...(hargaJualBaru !== undefined && { hargaJual: String(hargaJualBaru) }),
        ...(supplier !== undefined && { supplier: supplier?.trim() || null }),
        ...(settingPcs !== undefined && { settingPcs: Math.max(1, Number(settingPcs) || 1) }),
        ...(pakaiKarton !== undefined && { pakaiKarton: Boolean(pakaiKarton) }),
        ...(stokMinimum !== undefined && { stokMinimum: Number(stokMinimum) || 0 }),
        ...(keterangan !== undefined && { keterangan: keterangan?.trim() || null }),
        updatedAt: new Date(),
      })
      .where(eq(inventory.sku, decodedSku))
      .returning();

    if (hargaJualBerubah) {
      await db.insert(logs).values({
        user: actor,
        aksi: 'KOREKSI_INVENTORY',
        detail: `Edit master ${decodedSku}: harga jual ${existing.hargaJual} -> ${hargaJualBaru}`,
      });
    }

    // HPP rahasia tidak dikirim ke role yang tidak berhak melihatnya
    if (!canViewCostPrice(authResult.user)) {
      updated.hargaBeli = null;
      updated.hargaBeliKarton = '0';
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Data barang ${decodedSku} berhasil diperbarui`,
    });
  } catch (error: unknown) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Gagal memperbarui data barang';
    console.error('Error in PUT /api/inventory/[sku]:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuthRole(ROLES_EXECUTIVE);
    if (!authResult.authorized) return authResult.response;

    const { sku } = await params;
    const decodedSku = decodeURIComponent(sku).trim().toUpperCase();

    // Pastikan item ada
    const [existing] = await db
      .select({ id: inventory.id, sku: inventory.sku, namaBarang: inventory.namaBarang, stok: inventory.stok })
      .from(inventory)
      .where(eq(inventory.sku, decodedSku))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Barang dengan SKU "${decodedSku}" tidak ditemukan` },
        { status: 404 }
      );
    }

    // Aturan SOP: Stok fisik barang harus 0 / habis sebelum barang dapat dihapus
    const currentStock = Number(existing.stok) || 0;
    if (currentStock > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Barang "${existing.namaBarang}" (${decodedSku}) tidak dapat dihapus`,
          penyebab: `Sisa stok fisik masih tercatat ${currentStock} pcs. Stok harus 0 / habis terlebih dahulu (melalui transaksi penjualan POS, barang keluar, atau dicatat sebagai barang rusak / retur) untuk menjaga kesehatan dan audit alur barang.`,
        },
        { status: 400 }
      );
    }

    await db.delete(inventory).where(eq(inventory.sku, decodedSku));

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'HAPUS_MASTER_BARANG',
      detail: `Menghapus produk master SKU: ${decodedSku} (${existing.namaBarang})`,
    });

    return NextResponse.json({
      success: true,
      message: `Barang ${decodedSku} berhasil dihapus dari inventory`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal menghapus data barang';
    console.error('Error in DELETE /api/inventory/[sku]:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
