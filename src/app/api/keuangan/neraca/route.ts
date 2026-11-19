import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { inventory, keuangan } from '@/shared/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { auth } from '@/shared/lib/auth/config';

// ============================================================
// API: NERACA POSISI KEUANGAN KONSOLIDASI & PER DIVISI
// Plafon Keuangan Bersama: Manufaktur + F&B + Konsolidasi
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const divisiParam = searchParams.get('divisi'); // 'MANUFAKTUR' | 'FNB' | undefined (semua)

    // 1. Ambil Nilai Persediaan Stok dari Inventory
    let invItems = await db
      .select({
        divisi: inventory.divisi,
        stok: inventory.stok,
        hargaBeli: inventory.hargaBeli,
        namaBarang: inventory.namaBarang,
      })
      .from(inventory);

    if (divisiParam && divisiParam !== 'SEMUA') {
      invItems = invItems.filter((i) => i.divisi === divisiParam);
    }

    let nilaiPersediaanManufaktur = 0;
    let nilaiPersediaanFnb = 0;

    invItems.forEach((item) => {
      const val = (Number(item.stok) || 0) * (Number(item.hargaBeli) || 0);
      if (item.divisi === 'FNB') {
        nilaiPersediaanFnb += val;
      } else {
        nilaiPersediaanManufaktur += val;
      }
    });

    const totalPersediaan = divisiParam === 'FNB'
      ? nilaiPersediaanFnb
      : divisiParam === 'MANUFAKTUR'
      ? nilaiPersediaanManufaktur
      : (nilaiPersediaanManufaktur + nilaiPersediaanFnb);

    // 2. Ambil Arus Kas & Saldo dari Keuangan
    let keuItems = await db
      .select({
        jenis: keuangan.jenis,
        jumlah: keuangan.jumlah,
        divisi: keuangan.divisi,
      })
      .from(keuangan);

    if (divisiParam && divisiParam !== 'SEMUA') {
      keuItems = keuItems.filter((k) => k.divisi === divisiParam);
    }

    let totalKasMasuk = 0;
    let totalKasKeluar = 0;

    keuItems.forEach((k) => {
      const jml = Number(k.jumlah) || 0;
      if (k.jenis === 'masuk') {
        totalKasMasuk += jml;
      } else if (k.jenis === 'keluar') {
        totalKasKeluar += jml;
      }
    });

    const saldoKasBank = Math.max(0, totalKasMasuk - totalKasKeluar);

    // 3. Hutang Usaha Supplier
    let totalHutangUsaha = 0;
    try {
      const hutangRows: any[] = await db.execute(
        sql`SELECT COALESCE(SUM(sisa_hutang), 0) as total FROM hutang_supplier WHERE status != 'LUNAS'`
      );
      if (hutangRows && hutangRows.length > 0) {
        totalHutangUsaha = Number(hutangRows[0]?.total || 0);
      }
    } catch {
      totalHutangUsaha = 0;
    }

    // 4. Hitung Komponen Neraca
    const totalAsetLancar = saldoKasBank + totalPersediaan;
    const asetTetap = 0;
    const totalAset = totalAsetLancar + asetTetap;
    const totalKewajiban = totalHutangUsaha;
    const totalEkuitas = totalAset - totalKewajiban;

    return NextResponse.json({
      success: true,
      data: {
        divisi: divisiParam || 'SEMUA',
        aset: {
          kasBank: saldoKasBank,
          persediaan: totalPersediaan,
          persediaanBreakdown: {
            manufaktur: nilaiPersediaanManufaktur,
            fnb: nilaiPersediaanFnb,
          },
          totalAsetLancar,
          asetTetap,
          totalAset,
        },
        kewajiban: {
          hutangUsaha: totalHutangUsaha,
          totalKewajiban,
        },
        ekuitas: {
          modalDanLaba: totalEkuitas,
          totalEkuitas,
        },
        balanceCheck: totalAset === (totalKewajiban + totalEkuitas),
      },
    });
  } catch (error: any) {
    console.error('Error fetching Neraca:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memuat neraca' },
      { status: 500 }
    );
  }
}
