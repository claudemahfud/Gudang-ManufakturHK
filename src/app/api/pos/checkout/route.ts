import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { inventory, barangKeluar, keuangan, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_POS } from '@/shared/lib/auth/rbac';
import { eq, sql } from 'drizzle-orm';

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
    } = body as {
      items: CartItemInput[];
      pelanggan?: string;
      metodePembayaran?: 'Tunai' | 'Transfer' | 'QRIS';
      diskonPct?: number;
      uangDiterima?: number;
      catatan?: string;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Keranjang belanja kosong' },
        { status: 400 }
      );
    }

    // 1. Validasi stok semua item
    for (const item of items) {
      if (!item.sku || !item.qty || item.qty <= 0) {
        return NextResponse.json(
          { success: false, message: `Data item ${item.namaBarang || item.sku} tidak valid` },
          { status: 400 }
        );
      }

      const [inv] = await db
        .select()
        .from(inventory)
        .where(eq(inventory.sku, item.sku))
        .limit(1);

      if (!inv) {
        return NextResponse.json(
          { success: false, message: `Barang dengan SKU ${item.sku} tidak ditemukan di sistem` },
          { status: 404 }
        );
      }

      if (inv.stok < item.qty) {
        return NextResponse.json(
          {
            success: false,
            message: `Stok "${inv.namaBarang}" tidak mencukupi (Tersedia: ${inv.stok}, Diminta: ${item.qty})`,
          },
          { status: 400 }
        );
      }
    }

    // 2. Kalkulasi Nilai Transaksi
    const subtotal = items.reduce((acc, curr) => acc + curr.hargaJual * curr.qty, 0);
    const nominalDiskon = (subtotal * Number(diskonPct || 0)) / 100;
    const grandTotal = Math.max(0, subtotal - nominalDiskon);
    const kembalian =
      metodePembayaran === 'Tunai' ? Math.max(0, Number(uangDiterima) - grandTotal) : 0;

    if (metodePembayaran === 'Tunai' && uangDiterima < grandTotal) {
      return NextResponse.json(
        {
          success: false,
          message: `Uang yang diterima (Rp ${uangDiterima.toLocaleString('id-ID')}) kurang dari total tagihan (Rp ${grandTotal.toLocaleString('id-ID')})`,
        },
        { status: 400 }
      );
    }

    // 3. Generate Nomor Transaksi Unik
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const trxId = `POS-${dateStr}-${randomSuffix}`;
    const tanggalTrx = new Date();
    const cashierName = user.name || user.username || 'Kasir';

    // 4. Proses Transaksi Database (Atomic)
    const insertedItems: any[] = [];

    for (const item of items) {
      const itemSubtotal = item.hargaJual * item.qty;
      const itemDiskon = (itemSubtotal * Number(diskonPct || 0)) / 100;
      const itemNetTotal = itemSubtotal - itemDiskon;

      // Kurangi stok inventory
      await db
        .update(inventory)
        .set({
          stok: sql`${inventory.stok} - ${item.qty}`,
          updatedAt: new Date(),
        })
        .where(eq(inventory.sku, item.sku));

      // Catat ke barang_keluar
      const [bk] = await db
        .insert(barangKeluar)
        .values({
          trxId,
          tanggal: tanggalTrx,
          sku: item.sku,
          namaBarang: item.namaBarang,
          qty: item.qty,
          satuan: item.satuan || 'pcs',
          hargaJual: String(item.hargaJual),
          total: String(itemNetTotal),
          pelanggan,
          salesman: cashierName,
          diskon: String(diskonPct || 0),
          keterangan: `POS Checkout (${metodePembayaran})${catatan ? ` - ${catatan}` : ''}`,
          createdBy: user.username,
        })
        .returning();

      insertedItems.push(bk);
    }

    // Catat arus kas pemasukan ke keuangan
    await db.insert(keuangan).values({
      tanggal: tanggalTrx,
      jenis: 'masuk',
      kategori: 'Penjualan POS',
      jumlah: String(grandTotal),
      keterangan: `Penjualan POS #${trxId} (${metodePembayaran}) oleh ${cashierName} (${userRole})`,
      createdBy: user.username,
    });

    // Catat riwayat log aktivitas
    await db.insert(logs).values({
      user: cashierName,
      aksi: 'POS_CHECKOUT',
      detail: `Transaksi POS #${trxId} berhasil senilai Rp ${grandTotal.toLocaleString('id-ID')} (${items.length} item) ke ${pelanggan}`,
    });

    // 5. Kembalikan data lengkap untuk cetak nota thermal 58mm
    const receiptData = {
      trxId,
      tanggal: tanggalTrx.toISOString(),
      kasir: cashierName,
      role: userRole,
      pelanggan,
      metodePembayaran,
      items: items.map((i) => ({
        sku: i.sku,
        namaBarang: i.namaBarang,
        qty: i.qty,
        satuan: i.satuan || 'pcs',
        hargaJual: i.hargaJual,
        subtotal: i.hargaJual * i.qty,
      })),
      subtotal,
      diskonPct: Number(diskonPct || 0),
      nominalDiskon,
      grandTotal,
      uangDiterima: Number(uangDiterima || grandTotal),
      kembalian,
      catatan,
    };

    return NextResponse.json({
      success: true,
      message: 'Checkout POS berhasil diproses',
      data: receiptData,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
