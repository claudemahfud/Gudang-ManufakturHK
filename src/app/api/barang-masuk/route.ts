import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangMasuk, logs, kontak } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { eq, desc, and, gte, lte, or } from 'drizzle-orm';
import { catatBarangMasuk, catatPembayaranPembelian, resolveJatuhTempo } from '@/shared/lib/barang-masuk';

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
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;
    const session = { user: authResult.user };

    const body = await req.json();
    const {
      tanggal,
      sku,
      namaBarang,
      qty,
      satuan,
      hargaBeli,
      supplier,
      noFaktur,
      skemaBayar,
      jatuhTempo,
      keterangan,
    } = body;

    if (!sku || !namaBarang || !qty) {
      return NextResponse.json(
        {
          success: false,
          message: 'SKU, Nama Barang, dan Qty wajib diisi',
          penyebab: 'Informasi identitas barang dan jumlah kuantitas masuk tidak boleh kosong.',
        },
        { status: 400 }
      );
    }

    if (!supplier || !supplier.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Suplier wajib dipilih',
          penyebab: 'Setiap barang masuk wajib memiliki asal Suplier terdaftar untuk menjaga integritas alur inventaris dan buku kas/neraca.',
        },
        { status: 400 }
      );
    }

    const parsedQty = parseInt(qty, 10);
    const unitPrice = parseFloat(hargaBeli) || 0;
    const totalBeli = parsedQty * unitPrice;
    const paymentScheme = (skemaBayar || 'lunas').toLowerCase() === 'hutang' ? 'hutang' : 'lunas';
    const parsedTanggal = tanggal ? new Date(tanggal) : new Date();
    const parsedJatuhTempo = resolveJatuhTempo(paymentScheme, parsedTanggal, jatuhTempo);

    const sessionUser = session.user as any;
    const user = sessionUser?.name || sessionUser?.username || 'System';
    const isExecutive = ['Administrator', 'Direktur Utama', 'Manager'].includes(sessionUser?.role);
    const userCabang = sessionUser?.cabang || 'Pusat';
    const cabangToSave = (!isExecutive && userCabang !== 'ALL' && userCabang !== 'Pusat')
      ? userCabang
      : (body.cabang || 'Pusat');
    const divisiToSave = body.divisi || 'MANUFAKTUR';
    const skuNorm = sku.trim().toUpperCase();

    let insertedRecord: any = null;

    // Transaksi ACID untuk menjamin konsistensi Barang Masuk, Stok Inventory, Arus Kas, dan Neraca Hutang
    await db.transaction(async (tx) => {
      // 1-2. Catat barang masuk, HPP rata-rata, dan stok cabang
      const { row } = await catatBarangMasuk(tx, {
        tanggal: parsedTanggal,
        sku: skuNorm,
        namaBarang: namaBarang.trim(),
        qty: parsedQty,
        satuan: satuan || 'pcs',
        hargaBeli: unitPrice,
        supplier: supplier.trim(),
        noFaktur: noFaktur?.trim() || null,
        skemaBayar: paymentScheme,
        jatuhTempo: parsedJatuhTempo,
        divisi: divisiToSave,
        cabang: cabangToSave,
        keterangan: keterangan || null,
        user,
      });
      insertedRecord = row;

      // 3. Alur Kas & Neraca Otomatis
      await catatPembayaranPembelian(tx, {
        tanggal: parsedTanggal,
        total: totalBeli,
        supplier: supplier.trim(),
        noFaktur: noFaktur?.trim() || null,
        skemaBayar: paymentScheme,
        jatuhTempo: parsedJatuhTempo,
        divisi: divisiToSave,
        cabang: cabangToSave,
        uraian: `${namaBarang} (${sku}) x${parsedQty} ${satuan || 'pcs'}`,
        user,
      });

      // 4. Audit Log
      await tx.insert(logs).values({
        user,
        aksi: 'TAMBAH_BARANG_MASUK',
        detail: `Menambah barang masuk SKU: ${sku} (${parsedQty} ${satuan || 'pcs'}) dari suplier ${supplier.trim()} [Skema: ${paymentScheme.toUpperCase()}] Total: Rp ${totalBeli.toLocaleString('id-ID')}`,
      });
    });

    return NextResponse.json(
      {
        success: true,
        data: insertedRecord,
        message: `Barang masuk ${sku} berhasil dicatat dengan skema bayar ${paymentScheme.toUpperCase()}`,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Error in POST /api/barang-masuk:', err);
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal mencatat barang masuk',
        penyebab: err.message || 'Terjadi kesalahan sistem database saat memproses transaksi.',
      },
      { status: 500 }
    );
  }
}
