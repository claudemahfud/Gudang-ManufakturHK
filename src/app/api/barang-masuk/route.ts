import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangMasuk, inventory, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

// ============================================================
// API: /api/barang-masuk
// GET (list dengan filter tanggal/search) + POST (tambah barang masuk)
// ============================================================

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const divisi = searchParams.get('divisi');

    const user = session.user as any;
    const userRole = user?.role;
    const userCabang = user?.cabang || 'Pusat';
    const isExecutive = ['Administrator', 'Direktur Utama', 'Manager'].includes(userRole);

    let conditions: any[] = [];

    if (divisi && divisi !== 'SEMUA') {
      conditions.push(eq(barangMasuk.divisi, divisi));
    }

    // Filter Cabang: Karyawan cabang HANYA BISA akses data di cabang tempat mereka ditempatkan
    let effectiveCabang: string | null = null;
    if (!isExecutive && userCabang !== 'ALL' && userCabang !== 'Pusat') {
      effectiveCabang = userCabang;
    } else {
      const cabangParam = searchParams.get('cabang');
      if (cabangParam && cabangParam !== 'SEMUA') {
        effectiveCabang = cabangParam;
      }
    }

    if (effectiveCabang) {
      conditions.push(eq(barangMasuk.cabang, effectiveCabang));
    }

    if (startDate) {
      conditions.push(gte(barangMasuk.tanggal, new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(barangMasuk.tanggal, end));
    }

    let query = db
      .select()
      .from(barangMasuk)
      .orderBy(desc(barangMasuk.tanggal));

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    const results = await query.limit(100);

    const filtered = search
      ? results.filter(
          (item) =>
            item.namaBarang.toLowerCase().includes(search.toLowerCase()) ||
            item.sku.toLowerCase().includes(search.toLowerCase()) ||
            (item.supplier && item.supplier.toLowerCase().includes(search.toLowerCase()))
        )
      : results;

    return NextResponse.json({ success: true, data: filtered });
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
    const { tanggal, sku, namaBarang, qty, satuan, hargaBeli, supplier, noFaktur, keterangan } = body;

    if (!sku || !namaBarang || !qty) {
      return NextResponse.json(
        { success: false, message: 'SKU, Nama Barang, dan Qty wajib diisi' },
        { status: 400 }
      );
    }

    const parsedQty = parseInt(qty, 10);
    const sessionUser = session.user as any;
    const user = sessionUser?.name || sessionUser?.username || 'System';
    const isExecutive = ['Administrator', 'Direktur Utama', 'Manager'].includes(sessionUser?.role);
    const userCabang = sessionUser?.cabang || 'Pusat';
    const cabangToSave = (!isExecutive && userCabang !== 'ALL' && userCabang !== 'Pusat')
      ? userCabang
      : (body.cabang || 'Pusat');

    // Insert barang masuk
    const [inserted] = await db
      .insert(barangMasuk)
      .values({
        tanggal: tanggal ? new Date(tanggal) : new Date(),
        sku,
        namaBarang,
        qty: parsedQty,
        satuan: satuan || 'pcs',
        hargaBeli: hargaBeli ? String(hargaBeli) : '0',
        supplier: supplier || null,
        noFaktur: noFaktur || null,
        divisi: body.divisi || 'MANUFAKTUR',
        cabang: cabangToSave,
        keterangan: keterangan || null,
        createdBy: user,
      })
      .returning();

    // Update stock in inventory table
    await db
      .update(inventory)
      .set({
        stok: sql`${inventory.stok} + ${parsedQty}`,
        updatedAt: new Date(),
      })
      .where(eq(inventory.sku, sku));

    // Audit log
    await db.insert(logs).values({
      user,
      aksi: 'TAMBAH_BARANG_MASUK',
      detail: `Menambah barang masuk SKU: ${sku} (${parsedQty} ${satuan || 'pcs'}) dari ${supplier || '-'}`,
    });

    return NextResponse.json({ success: true, data: inserted }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
