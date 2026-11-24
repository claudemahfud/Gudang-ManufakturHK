import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { kontak, logs, hutangSupplier, inventory } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_EXECUTIVE } from '@/shared/lib/auth/rbac';
import { desc, or, eq, sql } from 'drizzle-orm';

// ============================================================
// API: /api/suppliers
// GET: Ambil daftar suplier resmi beserta rekap hutang & produk
// POST: Daftarkan suplier pemasok baru
// ============================================================

export async function GET(req: NextRequest) {
  try {
    // Dibaca segar dari DB: akun nonaktif/dihapus langsung ditolak walau token masih berlaku
    const authResult = await requireAuthRole();
    if (!authResult.authorized) return authResult.response;

    // Ambil data supplier dari tabel kontak
    const suppliers = await db
      .select()
      .from(kontak)
      .where(or(eq(kontak.tipe, 'supplier'), eq(kontak.tipe, 'keduanya')))
      .orderBy(desc(kontak.createdAt));

    // Ambil rekap hutang berjalan per supplier
    const debts = await db
      .select({
        supplier: hutangSupplier.supplier,
        totalSisaHutang: sql<number>`COALESCE(SUM(${hutangSupplier.sisaHutang}), 0)`,
      })
      .from(hutangSupplier)
      .where(sql`${hutangSupplier.status} != 'lunas'`)
      .groupBy(hutangSupplier.supplier);

    const debtMap = new Map<string, number>();
    debts.forEach((d) => {
      debtMap.set(d.supplier.toLowerCase().trim(), Number(d.totalSisaHutang) || 0);
    });

    // Ambil jumlah produk aktif per supplier
    const productCounts = await db
      .select({
        supplier: inventory.supplier,
        count: sql<number>`COUNT(*)`,
      })
      .from(inventory)
      .where(sql`${inventory.supplier} IS NOT NULL`)
      .groupBy(inventory.supplier);

    const prodMap = new Map<string, number>();
    productCounts.forEach((p) => {
      if (p.supplier) {
        prodMap.set(p.supplier.toLowerCase().trim(), Number(p.count) || 0);
      }
    });

    // Gabungkan data
    const enriched = suppliers.map((s) => {
      const key = s.nama.toLowerCase().trim();
      return {
        ...s,
        totalHutangAktif: debtMap.get(key) || 0,
        jumlahProduk: prodMap.get(key) || 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: enriched,
      total: enriched.length,
    });
  } catch (err: any) {
    console.error('Error GET /api/suppliers:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthRole(ROLES_EXECUTIVE);
    if (!authResult.authorized) return authResult.response;

    const body = await req.json();
    const { nama, telepon, alamat, email, keterangan } = body;

    if (!nama || !nama.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Nama Suplier / Vendor wajib diisi',
          penyebab: 'Field nama suplier merupakan identitas utama asal barang masuk dan tidak boleh kosong.',
        },
        { status: 400 }
      );
    }

    const trimmedName = nama.trim();

    // Cek duplikasi
    const [existing] = await db
      .select({ id: kontak.id, nama: kontak.nama })
      .from(kontak)
      .where(sql`LOWER(TRIM(${kontak.nama})) = LOWER(TRIM(${trimmedName}))`)
      .limit(1);

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: `Suplier "${trimmedName}" sudah terdaftar sebelumnya`,
          penyebab: 'Nama suplier sudah ada di database sistem. Gunakan nama yang berbeda atau perbarui data suplier yang sudah ada.',
        },
        { status: 400 }
      );
    }

    const user = authResult.user?.name || authResult.user?.username || 'System';

    const [inserted] = await db
      .insert(kontak)
      .values({
        nama: trimmedName,
        tipe: 'supplier',
        telepon: telepon?.trim() || null,
        alamat: alamat?.trim() || null,
        email: email?.trim() || null,
        keterangan: keterangan?.trim() || null,
        aktif: true,
      })
      .returning();

    await db.insert(logs).values({
      user,
      aksi: 'TAMBAH_SUPLIER',
      detail: `Mendaftarkan suplier baru: ${trimmedName}`,
    });

    return NextResponse.json(
      {
        success: true,
        data: inserted,
        message: `Suplier "${trimmedName}" berhasil didaftarkan`,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Error POST /api/suppliers:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
