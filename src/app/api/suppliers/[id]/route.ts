import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { kontak, logs, hutangSupplier, inventory, barangMasuk, poLoading } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_EXECUTIVE } from '@/shared/lib/auth/rbac';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuthRole(ROLES_EXECUTIVE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const body = await req.json();
    const { nama, telepon, alamat, email, keterangan } = body;

    if (!nama || !nama.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Nama suplier tidak boleh kosong',
          penyebab: 'Identitas suplier wajib valid untuk keperluan faktur dan alur barang masuk.',
        },
        { status: 400 }
      );
    }

    const namaBaru = nama.trim();
    const [lama] = await db.select({ nama: kontak.nama }).from(kontak).where(eq(kontak.id, id)).limit(1);
    if (!lama) {
      return NextResponse.json({ success: false, message: 'Suplier tidak ditemukan' }, { status: 404 });
    }

    const ganti = sameName(lama.nama, namaBaru) ? null : lama.nama;
    if (ganti) {
      const [dupe] = await db
        .select({ id: kontak.id })
        .from(kontak)
        .where(and(sql`LOWER(TRIM(${kontak.nama})) = LOWER(${namaBaru})`, ne(kontak.id, id)))
        .limit(1);
      if (dupe) {
        return NextResponse.json(
          { success: false, message: `Nama suplier "${namaBaru}" sudah dipakai kontak lain` },
          { status: 400 }
        );
      }
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(kontak)
        .set({
          nama: namaBaru,
          telepon: telepon?.trim() || null,
          alamat: alamat?.trim() || null,
          email: email?.trim() || null,
          keterangan: keterangan?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(kontak.id, id))
        .returning();

      // Barang, hutang & riwayat terhubung ke suplier lewat nama: ikut diganti
      if (ganti) {
        const match = (col: AnyPgColumn) => sql`LOWER(TRIM(${col})) = LOWER(TRIM(${ganti}))`;
        await tx.update(inventory).set({ supplier: namaBaru }).where(match(inventory.supplier));
        await tx.update(hutangSupplier).set({ supplier: namaBaru }).where(match(hutangSupplier.supplier));
        await tx.update(barangMasuk).set({ supplier: namaBaru }).where(match(barangMasuk.supplier));
        await tx.update(poLoading).set({ supplier: namaBaru }).where(match(poLoading.supplier));
      }
      return row;
    });

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'UPDATE_SUPLIER',
      detail: `Memperbarui data suplier ID: ${id} (${ganti ? `${ganti} -> ` : ''}${namaBaru})`,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Data suplier "${nama.trim()}" berhasil diperbarui`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuthRole(ROLES_EXECUTIVE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;

    // Ambil data kontak
    const [supplier] = await db
      .select()
      .from(kontak)
      .where(eq(kontak.id, id))
      .limit(1);

    if (!supplier) {
      return NextResponse.json(
        { success: false, message: 'Suplier tidak ditemukan' },
        { status: 404 }
      );
    }

    // 1. Cek apakah ada hutang supplier yang belum lunas
    const [unpaidDebt] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(hutangSupplier)
      .where(
        sql`LOWER(TRIM(${hutangSupplier.supplier})) = LOWER(TRIM(${supplier.nama})) AND ${hutangSupplier.status} != 'lunas'`
      );

    if (unpaidDebt && Number(unpaidDebt.count) > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Suplier "${supplier.nama}" tidak dapat dihapus!`,
          penyebab: `Masih terdapat kewajiban hutang supplier yang belum lunas di buku kas & neraca. Selesaikan pelunasan hutang terlebih dahulu.`,
        },
        { status: 400 }
      );
    }

    // 2. Semua barang dari suplier ini wajib habis (stok 0) di semua cabang
    const masihAda = await db
      .select({ sku: inventory.sku, namaBarang: inventory.namaBarang, stok: inventory.stok })
      .from(inventory)
      .where(sql`LOWER(TRIM(${inventory.supplier})) = LOWER(TRIM(${supplier.nama})) AND ${inventory.stok} > 0`)
      .orderBy(desc(inventory.stok));

    if (masihAda.length > 0) {
      const contoh = masihAda.slice(0, 5).map((i) => `${i.sku} ${i.namaBarang} (${i.stok} pcs)`).join(', ');
      return NextResponse.json(
        {
          success: false,
          message: `Suplier "${supplier.nama}" tidak dapat dihapus!`,
          penyebab: `Masih ada ${masihAda.length} barang dari suplier ini yang stoknya belum habis: ${contoh}${masihAda.length > 5 ? ', ...' : ''}. Habiskan stoknya lewat penjualan, Barang Keluar, retur, atau barang rusak terlebih dahulu.`,
        },
        { status: 400 }
      );
    }

    await db.delete(kontak).where(eq(kontak.id, id));

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'HAPUS_SUPLIER',
      detail: `Menghapus suplier: ${supplier.nama}`,
    });

    return NextResponse.json({
      success: true,
      message: `Suplier "${supplier.nama}" berhasil dihapus`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
