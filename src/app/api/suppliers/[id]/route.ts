import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { kontak, logs, hutangSupplier, inventory } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_EXECUTIVE } from '@/shared/lib/auth/rbac';
import { eq, sql } from 'drizzle-orm';

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

    const [updated] = await db
      .update(kontak)
      .set({
        nama: nama.trim(),
        telepon: telepon?.trim() || null,
        alamat: alamat?.trim() || null,
        email: email?.trim() || null,
        keterangan: keterangan?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(kontak.id, id))
      .returning();

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'UPDATE_SUPLIER',
      detail: `Memperbarui data suplier ID: ${id} (${nama.trim()})`,
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

    // 2. Cek apakah ada master produk yang terhubung ke suplier ini
    const [linkedProduct] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(inventory)
      .where(sql`LOWER(TRIM(${inventory.supplier})) = LOWER(TRIM(${supplier.nama}))`);

    if (linkedProduct && Number(linkedProduct.count) > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Suplier "${supplier.nama}" tidak dapat dihapus!`,
          penyebab: `Terdapat ${linkedProduct.count} produk master inventory yang terdaftar menggunakan suplier ini sebagai asal barang. Ubah suplier pada produk tersebut terlebih dahulu.`,
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
