import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { inventory } from '@/shared/lib/db/schema';
import { sql, or, and, ilike, desc, eq } from 'drizzle-orm';
import { auth } from '@/shared/lib/auth/config';
import { canViewCostPrice } from '@/shared/lib/auth/rbac';

// ============================================================
// API ROUTE: Master Inventory List & Create
// Endpoint:
// - GET /api/inventory (list with pagination + search + filter divisi)
// - POST /api/inventory (create item dengan tagging divisi)
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Harap login terlebih dahulu' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '10', 10));
    const search = searchParams.get('search')?.trim() || '';
    const divisiParam = searchParams.get('divisi') || req.cookies.get('app_active_division')?.value || 'MANUFAKTUR';

    const user = session?.user as any;
    const userRole = user?.role;
    const userCabang = user?.cabang || 'Pusat';
    const isExecutive = ['Administrator', 'Direktur Utama', 'Manager'].includes(userRole);

    const offset = (page - 1) * limit;

    // Filter pencarian: SKU, Nama Barang, atau Brand
    const searchCondition = search
      ? or(
          ilike(inventory.sku, `%${search}%`),
          ilike(inventory.namaBarang, `%${search}%`),
          ilike(inventory.brand, `%${search}%`)
        )
      : undefined;

    // Filter divisi: MANUFAKTUR | FNB (atau SEMUA)
    const divisiCondition = (divisiParam && divisiParam !== 'SEMUA')
      ? eq(inventory.divisi, divisiParam)
      : undefined;

    // Filter Cabang: Karyawan cabang HANYA BISA akses data di cabang tempat mereka ditempatkan
    let effectiveCabang: string | undefined = undefined;
    if (!isExecutive && userCabang !== 'ALL' && userCabang !== 'Pusat') {
      effectiveCabang = userCabang;
    } else {
      const cabangParam = searchParams.get('cabang') || req.cookies.get('app_active_cabang')?.value;
      if (cabangParam && cabangParam !== 'SEMUA') {
        effectiveCabang = decodeURIComponent(cabangParam);
      }
    }

    const cabangCondition = effectiveCabang
      ? eq(inventory.cabang, effectiveCabang)
      : undefined;

    const conditions = [searchCondition, divisiCondition, cabangCondition].filter(Boolean) as any[];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Hitung total data
    const [countResult] = await db
      .select({ count: sql<number>`CAST(COUNT(*) AS INTEGER)` })
      .from(inventory)
      .where(whereClause);

    const total = Number(countResult?.count) || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Ambil data halaman saat ini
    const items = await db
      .select()
      .from(inventory)
      .where(whereClause)
      .orderBy(desc(inventory.updatedAt), desc(inventory.createdAt))
      .limit(limit)
      .offset(offset);

    // Sanitasi data: Akun bawahan (Petugas Gudang, Kasir, Salesman) tidak boleh melihat Harga Beli / HPP
    const allowHpp = canViewCostPrice(userRole);

    const sanitizedItems = items.map((item) => {
      if (!allowHpp) {
        return {
          ...item,
          hargaBeli: '0',
        };
      }
      return item;
    });

    return NextResponse.json({
      success: true,
      data: sanitizedItems,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memuat data inventory';
    console.error('Error in GET /api/inventory:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Harap login terlebih dahulu' },
        { status: 401 }
      );
    }

    const user = session?.user as any;
    const userRole = user?.role;
    const userCabang = user?.cabang || 'Pusat';
    const isExecutive = ['Administrator', 'Direktur Utama', 'Manager'].includes(userRole);

    const body = await req.json();
    const {
      sku,
      namaBarang,
      brand,
      gramasi,
      varian,
      stok,
      hargaBeli,
      hargaJual,
      settingPcs,
      pakaiKarton,
      stokMinimum,
      keterangan,
    } = body;

    // Validasi input wajib
    if (!sku?.trim() || !namaBarang?.trim()) {
      return NextResponse.json(
        { success: false, error: 'SKU dan Nama Barang wajib diisi' },
        { status: 400 }
      );
    }

    const normalizedSku = sku.trim().toUpperCase();

    // Periksa keunikan SKU
    const [existing] = await db
      .select({ id: inventory.id })
      .from(inventory)
      .where(eq(inventory.sku, normalizedSku))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { success: false, error: `SKU "${normalizedSku}" sudah terdaftar` },
        { status: 400 }
      );
    }

    // Insert ke database
    const [inserted] = await db
      .insert(inventory)
      .values({
        sku: normalizedSku,
        namaBarang: namaBarang.trim(),
        brand: brand?.trim() || null,
        gramasi: gramasi?.trim() || null,
        varian: varian?.trim() || null,
        stok: Number(stok) || 0,
        hargaBeli: hargaBeli !== undefined && hargaBeli !== '' ? String(hargaBeli) : '0',
        hargaJual: hargaJual !== undefined && hargaJual !== '' ? String(hargaJual) : '0',
        settingPcs: Number(settingPcs) > 0 ? Number(settingPcs) : 1,
        pakaiKarton: pakaiKarton === undefined ? true : Boolean(pakaiKarton),
        stokMinimum: stokMinimum !== undefined && stokMinimum !== '' ? Number(stokMinimum) : 10,
        keterangan: keterangan?.trim() || null,
        divisi: body.divisi || req.cookies.get('app_active_division')?.value || 'MANUFAKTUR',
        cabang: (!isExecutive && userCabang !== 'ALL' && userCabang !== 'Pusat')
          ? userCabang
          : (body.cabang || req.cookies.get('app_active_cabang')?.value || 'Pusat'),
        tipeItem: body.tipeItem || (body.divisi === 'FNB' ? 'bahan_mentah' : 'barang_jadi'),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: inserted,
        message: 'Barang baru berhasil ditambahkan ke inventory',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal menyimpan barang baru';
    console.error('Error in POST /api/inventory:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
