import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangKeluar, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { requireAuthRole, ROLES_STOCK_OUT } from '@/shared/lib/auth/rbac';
import { decrementStock, errorResponse, normalizeSku, parsePositiveInt } from '@/shared/lib/stock';
import { generateTrxId } from '@/shared/lib/utils';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

// ============================================================
// API: /api/barang-keluar
// GET (list pengeluaran barang) + POST (surat loading/keluar multi-item)
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
    const channel = searchParams.get('channel');

    const user = session.user as any;
    const userRole = user?.role;
    const userCabang = user?.cabang || 'Pusat';
    const isExecutive = ['Administrator', 'Direktur Utama', 'Manager'].includes(userRole);

    let conditions: any[] = [];

    if (divisi && divisi !== 'SEMUA') {
      conditions.push(eq(barangKeluar.divisi, divisi));
    }

    if (channel && channel !== 'ALL' && channel !== 'SEMUA') {
      conditions.push(eq(barangKeluar.channel, channel));
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
      conditions.push(eq(barangKeluar.cabang, effectiveCabang));
    }

    if (startDate) {
      conditions.push(gte(barangKeluar.tanggal, new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(barangKeluar.tanggal, end));
    }

    let query = db
      .select()
      .from(barangKeluar)
      .orderBy(desc(barangKeluar.tanggal));

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    const results = await query.limit(150);

    const filtered = search
      ? results.filter(
          (item) =>
            item.trxId.toLowerCase().includes(search.toLowerCase()) ||
            item.namaBarang.toLowerCase().includes(search.toLowerCase()) ||
            item.sku.toLowerCase().includes(search.toLowerCase()) ||
            (item.pelanggan && item.pelanggan.toLowerCase().includes(search.toLowerCase())) ||
            (item.salesman && item.salesman.toLowerCase().includes(search.toLowerCase()))
        )
      : results;

    return NextResponse.json({ success: true, data: filtered });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_STOCK_OUT);
    if (!authResult.authorized) return authResult.response;
    const session = { user: authResult.user };

    const body = await req.json();
    const { tanggal, pelanggan, salesman, keterangan, items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Daftar item barang keluar tidak boleh kosong' },
        { status: 400 }
      );
    }

    const trxId = generateTrxId('OUT');
    const sessionUser = session.user as any;
    const user = sessionUser?.name || sessionUser?.username || 'System';
    const isExecutive = ['Administrator', 'Direktur Utama', 'Manager'].includes(sessionUser?.role);
    const userCabang = sessionUser?.cabang || 'Pusat';
    const cabangToSave = (!isExecutive && userCabang !== 'ALL' && userCabang !== 'Pusat')
      ? userCabang
      : (body.cabang || 'Pusat');
    const trxDate = tanggal ? new Date(tanggal) : new Date();

    // Validasi bentuk data semua item sebelum menyentuh stok.
    // Harga grosir boleh dinegosiasi per transaksi, tapi wajib angka >= 0
    // dan diskon dibatasi 0-100%.
    const lines: { sku: string; qty: number; hargaJual: number; diskon: number; satuan: string }[] = [];
    for (const it of items) {
      const sku = normalizeSku(it?.sku);
      const qty = parsePositiveInt(it?.qty);
      const hargaJual = Number(it?.hargaJual ?? 0);
      const diskon = Number(it?.diskon ?? 0);
      if (!sku || !qty) {
        return NextResponse.json(
          { success: false, message: `Jumlah kuantitas untuk item ${it?.namaBarang || it?.sku || ''} tidak valid` },
          { status: 400 }
        );
      }
      if (!Number.isFinite(hargaJual) || hargaJual < 0 || !Number.isFinite(diskon) || diskon < 0 || diskon > 100) {
        return NextResponse.json(
          { success: false, message: `Harga atau diskon untuk item ${it?.namaBarang || sku} tidak valid` },
          { status: 400 }
        );
      }
      lines.push({ sku, qty, hargaJual, diskon, satuan: it.satuan || 'pcs' });
    }

    const insertedRows: (typeof barangKeluar.$inferSelect)[] = [];

    await db.transaction(async (tx) => {
      for (const it of lines) {
        const { qty, hargaJual, diskon } = it;
        const subtotal = Math.round(qty * hargaJual * (1 - diskon / 100) * 100) / 100;

        // Kurangi stok hanya bila masih cukup (aman dari transaksi bersamaan)
        const inv = await decrementStock(tx, it.sku, qty);

        const [row] = await tx
          .insert(barangKeluar)
          .values({
            trxId,
            tanggal: trxDate,
            sku: it.sku,
            namaBarang: inv.namaBarang,
            qty,
            satuan: it.satuan || 'pcs',
            hargaJual: String(hargaJual),
            total: String(subtotal),
            pelanggan: pelanggan || null,
            salesman: salesman || null,
            diskon: String(diskon),
            divisi: body.divisi || 'MANUFAKTUR',
            cabang: cabangToSave,
            channel: body.channel || 'GROSIR',
            keterangan: keterangan || null,
            createdBy: user,
          })
          .returning();

        insertedRows.push(row);
      }

      // Audit log
      await tx.insert(logs).values({
        user,
        aksi: 'PENGELUARAN_BARANG',
        detail: `Mencatat transaksi keluar ${trxId} (${items.length} item) ke ${pelanggan || '-'}`,
      });
    });

    return NextResponse.json(
      { success: true, trxId, data: insertedRows, message: 'Barang keluar berhasil dicatat' },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err, 'BARANG_KELUAR_POST');
  }
}
