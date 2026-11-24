import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangKeluar } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_STOCK_OUT } from '@/shared/lib/auth/rbac';
import { BusinessError, errorResponse, normalizeSku, parsePositiveInt } from '@/shared/lib/stock';
import { buatFakturPenjualan, type BarisInput } from '@/shared/lib/faktur-penjualan';
import type { MetodeBayar } from '@/shared/lib/faktur-hitung';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { roleUtamaDi } from '@/shared/lib/auth/roles';
import { nomorUrut } from '@/shared/lib/nomor-urut';

// ============================================================
// API: /api/barang-keluar
// GET (list pengeluaran barang) + POST (Faktur Penjualan grosir multi-item)
// ============================================================

export async function GET(req: Request) {
  try {
    // Dibaca segar dari DB: akun nonaktif/dihapus langsung ditolak walau token masih berlaku
    const authResult = await requireAuthRole();
    if (!authResult.authorized) return authResult.response;
    const session = { user: authResult.user };

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const divisi = searchParams.get('divisi');
    const channel = searchParams.get('channel');

    const user = session.user as any;
    const userCabang = user?.cabang || 'Pusat';
    const isExecutive = roleUtamaDi(user, ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum']);

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

// POST = Faktur Penjualan grosir: header faktur + baris barang (stok berkurang)
// + kas masuk untuk yang dibayar; sisa menjadi piutang di faktur.
export async function POST(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_STOCK_OUT);
    if (!authResult.authorized) return authResult.response;
    const sessionUser = authResult.user as { name?: string; username?: string; role?: string; roles?: string[]; cabang?: string };

    const body = await req.json();
    const { items } = body;
    const pelanggan = typeof body.pelanggan === 'string' ? body.pelanggan.trim() : '';
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

    if (!pelanggan) {
      return NextResponse.json({ success: false, message: 'Pelanggan wajib diisi' }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Daftar barang faktur tidak boleh kosong' },
        { status: 400 }
      );
    }

    const metodeBayar: MetodeBayar = ['tunai', 'transfer', 'tempo'].includes(body.metodeBayar)
      ? body.metodeBayar
      : 'tunai';
    const angka = (v: unknown, nama: string, max = Infinity) => {
      if (v === undefined || v === null || v === '') return 0;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > max) throw new BusinessError(`${nama} tidak valid`);
      return n;
    };

    const user = sessionUser?.name || sessionUser?.username || 'System';
    const isExecutive = roleUtamaDi(sessionUser, ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum']);
    const userCabang = sessionUser?.cabang || 'Pusat';
    const cabangToSave = (!isExecutive && userCabang !== 'ALL' && userCabang !== 'Pusat')
      ? userCabang
      : (body.cabang || 'Pusat');
    const trxDate = body.tanggal ? new Date(body.tanggal) : new Date();
    const jatuhTempo = body.jatuhTempo ? new Date(body.jatuhTempo) : null;
    if (Number.isNaN(trxDate.getTime()) || (jatuhTempo && Number.isNaN(jatuhTempo.getTime()))) {
      throw new BusinessError('Tanggal faktur / jatuh tempo tidak valid');
    }

    // Validasi bentuk data semua item sebelum menyentuh stok.
    // Harga grosir boleh dinegosiasi per transaksi, tapi wajib angka >= 0
    // dan diskon dibatasi 0-100%.
    const baris: BarisInput[] = [];
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
      baris.push({ sku, qty, hargaJual, diskon, satuan: it?.satuan === 'karton' ? 'karton' : 'pcs' });
    }

    // Nomor diambil di dalam transaksi: gagal simpan = nomor tidak terpakai
    let noFaktur = '';
    const hasil = await db.transaction(async (tx) => {
      noFaktur = await nomorUrut(tx, 'FKT');
      return buatFakturPenjualan(tx, {
        noFaktur,
        tanggal: trxDate,
        jatuhTempo,
        pelanggan,
        pelangganId: str(body.pelangganId),
        telepon: str(body.telepon),
        alamat: str(body.alamat),
        salesman: str(body.salesman),
        baris,
        diskonFaktur: angka(body.diskonFaktur, 'Diskon faktur'),
        ppnPersen: angka(body.ppnPersen, 'PPN', 100),
        ongkir: angka(body.ongkir, 'Ongkos kirim'),
        metodeBayar,
        dibayar: body.dibayar === undefined || body.dibayar === '' ? undefined : angka(body.dibayar, 'Jumlah dibayar'),
        divisi: body.divisi || 'MANUFAKTUR',
        cabang: cabangToSave,
        catatan: str(body.keterangan),
        user,
      });
    });

    return NextResponse.json(
      {
        success: true,
        trxId: noFaktur,
        noFaktur,
        faktur: hasil.faktur,
        data: hasil.rows,
        message: `Faktur penjualan ${noFaktur} berhasil dibuat`,
      },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err, 'BARANG_KELUAR_POST');
  }
}
