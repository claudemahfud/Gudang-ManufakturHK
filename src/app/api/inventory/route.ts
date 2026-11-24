import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { inventory, kontak, stokCabang } from '@/shared/lib/db/schema';
import { sql, or, and, ilike, desc, eq, getTableColumns } from 'drizzle-orm';
import { auth } from '@/shared/lib/auth/config';
import { canViewCostPrice, requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { roleUtamaDi } from '@/shared/lib/auth/roles';

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
    const userCabang = user?.cabang || 'Pusat';
    const isExecutive = roleUtamaDi(user, ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum']);

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

    // Barang tampil di cabang pemiliknya atau di cabang yang punya stoknya (hasil mutasi)
    const stokDiCabang = effectiveCabang
      ? sql`from ${stokCabang} where ${stokCabang.sku} = ${inventory.sku} and ${stokCabang.cabang} = ${effectiveCabang}`
      : undefined;
    const cabangCondition = effectiveCabang
      ? or(eq(inventory.cabang, effectiveCabang), sql`exists (select 1 ${stokDiCabang})`)
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
    // stok = stok cabang aktif; tanpa filter cabang (SEMUA) = total semua cabang
    const rows = await db
      .select({
        ...getTableColumns(inventory),
        stokCabang: stokDiCabang
          ? sql<number>`coalesce((select ${stokCabang.stok} ${stokDiCabang}), 0)`.mapWith(Number)
          : sql<number | null>`null`,
      })
      .from(inventory)
      .where(whereClause)
      .orderBy(desc(inventory.updatedAt), desc(inventory.createdAt))
      .limit(limit)
      .offset(offset);
    const items = rows.map(({ stokCabang: sc, ...item }) => (sc === null ? item : { ...item, stok: sc }));

    // Sanitasi data: Akun bawahan (Petugas Gudang, Kasir, Salesman) tidak boleh melihat Harga Beli / HPP
    const allowHpp = canViewCostPrice(user);

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
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;
    const session = { user: authResult.user };

    const user = session?.user as any;
    const userCabang = user?.cabang || 'Pusat';
    const isExecutive = roleUtamaDi(user, ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum']);

    const body = await req.json();
    const {
      sku,
      namaBarang,
      brand,
      gramasi,
      varian,
      hargaBeli,
      hargaJual,
      supplier,
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

    // Validasi Keberadaan Suplier (Aturan: Jika suplier belum ada, tidak bisa tambah barang baru)
    const [supplierCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(kontak)
      .where(or(eq(kontak.tipe, 'supplier'), eq(kontak.tipe, 'keduanya')));

    if (!supplierCount || Number(supplierCount.count) === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Belum ada Suplier yang terdaftar di sistem',
          penyebab: 'Setiap barang baru wajib memiliki asal Suplier pemasok. Silakan daftarkan suplier terlebih dahulu melalui menu "Daftar Suplier".',
        },
        { status: 400 }
      );
    }

    if (!supplier || !supplier.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Suplier pemasok wajib dipilih',
          penyebab: 'Barang baru wajib dikaitkan dengan Suplier sebagai sumber pengadaan barang masuk.',
        },
        { status: 400 }
      );
    }

    // Aturan 1: Validasi Kesamaan Nama Barang dari Suplier Berbeda -> Wajib Tambahkan Brand
    const existingWithSameName = await db
      .select({
        id: inventory.id,
        sku: inventory.sku,
        namaBarang: inventory.namaBarang,
        brand: inventory.brand,
        supplier: inventory.supplier,
        hargaBeli: inventory.hargaBeli,
      })
      .from(inventory)
      .where(sql`LOWER(TRIM(${inventory.namaBarang})) = LOWER(TRIM(${namaBarang}))`)
      .limit(5);

    if (existingWithSameName.length > 0) {
      const differentSupplierItem = existingWithSameName.find(
        (i) => i.supplier && i.supplier.trim().toLowerCase() !== supplier.trim().toLowerCase()
      );

      if (differentSupplierItem && (!brand || !brand.trim())) {
        return NextResponse.json(
          {
            success: false,
            error: 'Brand / Merek wajib diisi!',
            penyebab: `Ditemukan barang dengan nama yang sama ("${differentSupplierItem.namaBarang}") dari Suplier lain ("${differentSupplierItem.supplier}"). Anda wajib mencantumkan Brand/Merek agar identitas dan kualitas produk tidak tertukar di gudang dan kasir.`,
          },
          { status: 400 }
        );
      }
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

    // Master barang hanya mendaftarkan item: stok selalu 0.
    // Stok hanya bertambah/berkurang lewat Barang Masuk / Barang Keluar.
    const [inserted] = await db
      .insert(inventory)
      .values({
        sku: normalizedSku,
        namaBarang: namaBarang.trim(),
        brand: brand?.trim() || null,
        gramasi: gramasi?.trim() || null,
        varian: varian?.trim() || null,
        stok: 0,
        hargaBeli: hargaBeli !== undefined && hargaBeli !== '' ? String(hargaBeli) : '0',
        hargaJual: hargaJual !== undefined && hargaJual !== '' ? String(hargaJual) : '0',
        supplier: supplier?.trim() || null,
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
