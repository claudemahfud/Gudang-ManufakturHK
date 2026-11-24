import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangKeluar, inventory } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_PROFIT_MARGIN } from '@/shared/lib/auth/rbac';
import { desc, and, gte, lte, eq, sql } from 'drizzle-orm';
import { roleUtamaDi } from '@/shared/lib/auth/roles';

// ============================================================
// API: /api/laporan/penjualan
// Laporan Penjualan Detail: Omset, HPP, Laba/Profit, Diskon
// Hak Akses: Khusus Eksekutif (Administrator, Direktur Utama, Manager)
// ============================================================

export async function GET(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_PROFIT_MARGIN);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const salesman = searchParams.get('salesman');
    const divisi = searchParams.get('divisi');

    // Filter periode/divisi/salesman di database (sebelumnya: ambil 500 baris terakhir lalu
    // disaring di memori, sehingga total salah begitu data > 500 baris).
    // Batas tanggal dilebarkan 1 hari agar aman untuk zona waktu; halaman menyaring jam persisnya.
    const syarat = [];
    if (divisi && divisi !== 'SEMUA') syarat.push(eq(barangKeluar.divisi, divisi));
    if (salesman && salesman !== 'all') syarat.push(eq(barangKeluar.salesman, salesman));
    if (startDate && !Number.isNaN(Date.parse(startDate))) {
      syarat.push(gte(barangKeluar.tanggal, new Date(Date.parse(startDate) - 86_400_000)));
    }
    if (endDate && !Number.isNaN(Date.parse(endDate))) {
      syarat.push(lte(barangKeluar.tanggal, new Date(Date.parse(endDate) + 86_400_000)));
    }

    // Query data barang keluar join inventory untuk mendapatkan harga_beli (HPP)
    const rows = await db
      .select({
        id: barangKeluar.id,
        trxId: barangKeluar.trxId,
        tanggal: barangKeluar.tanggal,
        sku: barangKeluar.sku,
        namaBarang: barangKeluar.namaBarang,
        qty: barangKeluar.qty,
        satuan: barangKeluar.satuan,
        hargaJual: barangKeluar.hargaJual,
        total: barangKeluar.total,
        diskon: barangKeluar.diskon,
        pelanggan: barangKeluar.pelanggan,
        salesman: barangKeluar.salesman,
        divisi: barangKeluar.divisi,
        cabang: barangKeluar.cabang,
        keterangan: barangKeluar.keterangan,
        hargaBeli: inventory.hargaBeli,
      })
      .from(barangKeluar)
      .leftJoin(inventory, eq(barangKeluar.sku, inventory.sku))
      .where(syarat.length ? and(...syarat) : undefined)
      .orderBy(desc(barangKeluar.tanggal))
      .limit(20000); // pengaman memori; per periode jauh di bawah angka ini

    // Filter tanggal, salesman & divisi in-memory
    let filtered = rows;

    if (divisi && divisi !== 'SEMUA') {
      filtered = filtered.filter((r) => r.divisi === divisi);
    }

    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      filtered = filtered.filter((r) => new Date(r.tanggal) >= s);
    }

    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      filtered = filtered.filter((r) => new Date(r.tanggal) <= e);
    }

    if (salesman && salesman !== 'all') {
      filtered = filtered.filter((r) => r.salesman === salesman);
    }

    // Isolasi Cabang: Karyawan cabang hanya dapat melihat transaksi di cabangnya
    const userCabang = (authResult.user as any)?.cabang || 'Pusat';
    const isExecutive = roleUtamaDi(authResult.user, ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum', 'Finance & Accounting']);
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
      filtered = filtered.filter((r) => r.cabang === effectiveCabang);
    }

    // Hitung Laba/Profit per baris & Total agregat
    let totalOmset = 0;
    let totalHpp = 0;
    let totalLaba = 0;
    let totalDiskonNominal = 0;

    const data = filtered.map((row) => {
      const qty = Number(row.qty || 0);
      const hj = Number(row.hargaJual || 0);
      const hb = Number(row.hargaBeli || 0);
      const totalNetto = Number(row.total || (hj * qty));
      const diskonPct = Number(row.diskon || 0);

      const subtotalKotor = hj * qty;
      const nominalDiskon = (subtotalKotor * diskonPct) / 100;
      const hppTotal = hb * qty;
      const laba = totalNetto - hppTotal;
      const marginPct = totalNetto > 0 ? (laba / totalNetto) * 100 : 0;

      totalOmset += totalNetto;
      totalHpp += hppTotal;
      totalLaba += laba;
      totalDiskonNominal += nominalDiskon;

      return {
        ...row,
        subtotalKotor,
        nominalDiskon,
        hppTotal,
        laba,
        marginPct: Number(marginPct.toFixed(1)),
      };
    });

    const marginRataRata = totalOmset > 0 ? (totalLaba / totalOmset) * 100 : 0;

    return NextResponse.json({
      success: true,
      summary: {
        totalOmset,
        totalHpp,
        totalLaba,
        totalDiskonNominal,
        marginRataRata: Number(marginRataRata.toFixed(1)),
        totalTransaksi: new Set(data.map((d) => d.trxId)).size,
        totalQtyTerjual: data.reduce((acc, c) => acc + c.qty, 0),
      },
      data,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
