import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { inventory, barangKeluar, keuangan, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_POS } from '@/shared/lib/auth/rbac';
import { eq } from 'drizzle-orm';
import { decrementStock, errorResponse, normalizeSku, parsePositiveInt } from '@/shared/lib/stock';
import { generateTrxId } from '@/shared/lib/utils';

// ============================================================
// API: /api/pos/checkout
// Endpoint kasir POS untuk smartphone & desktop
// Multi-role: Admin, Direktur Utama, Manager, Gudang, Salesman, Agen
// ============================================================

interface CartItemInput {
  sku: string;
  namaBarang: string;
  qty: number;
  hargaJual: number;
  satuan?: string;
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_POS);
    if (!authResult.authorized) return authResult.response;

    const { user, userRole } = authResult;
    const body = await req.json();

    const {
      items,
      pelanggan = 'Umum (Cash)',
      metodePembayaran = 'Tunai',
      diskonPct = 0,
      uangDiterima = 0,
      catatan = '',
      divisi = 'MANUFAKTUR',
      cabang = 'Pusat',
    } = body as {
      items: CartItemInput[];
      pelanggan?: string;
      metodePembayaran?: 'Tunai' | 'Transfer' | 'QRIS';
      diskonPct?: number;
      uangDiterima?: number;
      catatan?: string;
      divisi?: 'MANUFAKTUR' | 'FNB';
      cabang?: string;
    };

    // Isolasi Cabang: Karyawan cabang otomatis dikunci ke cabang penempatannya
    const isExecutive = ['Administrator', 'Direktur Utama', 'Manager'].includes(userRole as any);
    const userCabang = (user as any)?.cabang;
    const finalCabang = (!isExecutive && userCabang && userCabang !== 'ALL' && userCabang !== 'Pusat')
      ? userCabang
      : (cabang || 'Pusat');

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Keranjang belanja kosong' },
        { status: 400 }
      );
    }

    // 1. Validasi item & ambil harga resmi dari master inventory.
    //    Harga & nama dari klien diabaikan agar tidak bisa dimanipulasi.
    const lines: { sku: string; namaBarang: string; qty: number; hargaJual: number; satuan: string }[] = [];
    for (const item of items) {
      const sku = normalizeSku(item?.sku);
      const qty = parsePositiveInt(item?.qty);
      if (!sku || !qty) {
        return NextResponse.json(
          { success: false, message: `Data item ${item?.namaBarang || item?.sku || ''} tidak valid` },
          { status: 400 }
        );
      }

      const [inv] = await db
        .select({ namaBarang: inventory.namaBarang, hargaJual: inventory.hargaJual, stok: inventory.stok })
        .from(inventory)
        .where(eq(inventory.sku, sku))
        .limit(1);

      if (!inv) {
        return NextResponse.json(
          { success: false, message: `Barang dengan SKU ${sku} tidak ditemukan di sistem` },
          { status: 404 }
        );
      }

      lines.push({
        sku,
        namaBarang: inv.namaBarang,
        qty,
        hargaJual: Number(inv.hargaJual ?? 0),
        satuan: item.satuan || 'pcs',
      });
    }

    // 2. Kalkulasi Nilai Transaksi (diskon dibatasi 0-100%)
    const diskon = Math.min(100, Math.max(0, Number(diskonPct) || 0));
    const subtotal = roundRp(lines.reduce((acc, l) => acc + l.hargaJual * l.qty, 0));
    const nominalDiskon = roundRp((subtotal * diskon) / 100);
    const grandTotal = Math.max(0, roundRp(subtotal - nominalDiskon));
    const uangMasuk = Math.max(0, Number(uangDiterima) || 0);
    const kembalian = metodePembayaran === 'Tunai' ? Math.max(0, roundRp(uangMasuk - grandTotal)) : 0;

    if (metodePembayaran === 'Tunai' && uangMasuk < grandTotal) {
      return NextResponse.json(
        {
          success: false,
          message: `Uang yang diterima (Rp ${uangMasuk.toLocaleString('id-ID')}) kurang dari total tagihan (Rp ${grandTotal.toLocaleString('id-ID')})`,
        },
        { status: 400 }
      );
    }

    // 3. Generate Nomor Transaksi Unik
    const trxId = generateTrxId('POS');
    const tanggalTrx = new Date();
    const cashierName = user.name || user.username || 'Kasir';

    // 4. Proses Transaksi Database (Atomic Transaction)
    await db.transaction(async (tx) => {
      for (const item of lines) {
        const itemSubtotal = item.hargaJual * item.qty;
        const itemNetTotal = roundRp(itemSubtotal - (itemSubtotal * diskon) / 100);

        // Kurangi stok hanya bila masih cukup (aman dari checkout bersamaan)
        await decrementStock(tx, item.sku, item.qty);

        // Catat ke barang_keluar
        await tx
          .insert(barangKeluar)
          .values({
            trxId,
            tanggal: tanggalTrx,
            sku: item.sku,
            namaBarang: item.namaBarang,
            qty: item.qty,
            satuan: item.satuan,
            hargaJual: String(item.hargaJual),
            total: String(itemNetTotal),
            pelanggan,
            salesman: cashierName,
            diskon: String(diskon),
            divisi,
            cabang: finalCabang,
            channel: 'POS',
            keterangan: `POS Checkout (${metodePembayaran}) [${divisi} - ${finalCabang}]${catatan ? ` - ${catatan}` : ''}`,
            createdBy: user.username,
          });
      }

      // Catat arus kas pemasukan ke keuangan
      await tx.insert(keuangan).values({
        tanggal: tanggalTrx,
        jenis: 'masuk',
        kategori: 'Penjualan POS',
        jumlah: String(grandTotal),
        divisi,
        cabang: finalCabang,
        keterangan: `Penjualan POS [${divisi} - ${finalCabang}] #${trxId} (${metodePembayaran}) oleh ${cashierName} (${userRole})`,
        createdBy: user.username,
      });

      // Catat riwayat log aktivitas
      await tx.insert(logs).values({
        user: cashierName,
        aksi: 'POS_CHECKOUT',
        detail: `Transaksi POS #${trxId} berhasil senilai Rp ${grandTotal.toLocaleString('id-ID')} (${items.length} item) ke ${pelanggan}`,
      });
    });

    // 5. Kembalikan data lengkap untuk cetak nota thermal 58mm
    const receiptData = {
      trxId,
      tanggal: tanggalTrx.toISOString(),
      kasir: cashierName,
      role: userRole,
      pelanggan,
      metodePembayaran,
      items: lines.map((i) => ({
        sku: i.sku,
        namaBarang: i.namaBarang,
        qty: i.qty,
        satuan: i.satuan,
        hargaJual: i.hargaJual,
        subtotal: roundRp(i.hargaJual * i.qty),
      })),
      subtotal,
      diskonPct: diskon,
      nominalDiskon,
      grandTotal,
      uangDiterima: uangMasuk || grandTotal,
      kembalian,
      catatan,
    };

    return NextResponse.json({
      success: true,
      message: 'Checkout POS berhasil diproses',
      data: receiptData,
    });
  } catch (err) {
    return errorResponse(err, 'POS_CHECKOUT');
  }
}

function roundRp(n: number): number {
  return Math.round(n * 100) / 100;
}
