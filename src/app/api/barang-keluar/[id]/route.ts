import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangKeluar, keuangan, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_EXECUTIVE } from '@/shared/lib/auth/rbac';
import { eq } from 'drizzle-orm';
import { BusinessError, errorResponse, incrementStock } from '@/shared/lib/stock';
import { assertSupervisorPin, getPengaturan } from '@/shared/lib/pengaturan';
import { batalkanFakturPenjualan } from '@/shared/lib/faktur-penjualan';
import { AKUN, AKUN_KAS, barisJurnalAktif, posting } from '@/shared/lib/jurnal';
import { tanggungKantor } from '@/shared/lib/setoran';

const rp = (n: number) => Math.round(n * 100) / 100;

// ============================================================
// API: /api/barang-keluar/[id]
// DELETE barang keluar & rollback stok inventory
// Hak Akses: Administrator, Direktur Utama, Manager (Executive Anti-Fraud)
// ============================================================

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthRole(ROLES_EXECUTIVE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const user = authResult.user?.name || authResult.user?.username || 'System';

    // Hapus transaksi wajib PIN supervisor bila Direktur mewajibkannya
    const pengaturan = await getPengaturan();
    if (pengaturan.wajibPin && pengaturan.pinHapusTransaksi) {
      const body = await req.json().catch(() => ({}));
      await assertSupervisorPin(pengaturan, body?.supervisorPin, authResult.user?.username || 'unknown', `hapus barang keluar ${id}`);
    }

    const batalFaktur = await db.transaction(async (tx) => {
      // Baris bagian dari Faktur Penjualan: batalkan seluruh faktur
      // (total, PPN, pembayaran berlaku per faktur, bukan per baris)
      const [ref] = await tx.select({ trxId: barangKeluar.trxId }).from(barangKeluar).where(eq(barangKeluar.id, id)).limit(1);
      if (ref) {
        const batal = await batalkanFakturPenjualan(tx, ref.trxId, user, authResult.user?.username ?? null);
        if (batal) return batal;
      }

      // Hapus dulu & ambil barisnya: bila dua request hapus bersamaan,
      // hanya satu yang mendapat baris sehingga stok tidak dikembalikan dua kali.
      const [item] = await tx.delete(barangKeluar).where(eq(barangKeluar.id, id)).returning();
      if (!item) throw new BusinessError('Data pengeluaran tidak ditemukan', 404);

      // Rollback stok inventory (+ qty)
      await incrementStock(tx, item.sku, item.qty, item.cabang);

      // Penjualan POS sudah tercatat sebagai kas masuk: buat jurnal pembalik
      // agar buku kas tetap sesuai dengan barang yang benar-benar terjual.
      const total = Number(item.total ?? 0);
      if (item.channel === 'POS' && total > 0) {
        await tx.insert(keuangan).values({
          tanggal: new Date(),
          jenis: 'keluar',
          kategori: 'Pembatalan Penjualan POS',
          jumlah: String(total),
          divisi: item.divisi,
          cabang: item.cabang,
          keterangan: `Pembatalan item ${item.sku} x${item.qty} dari transaksi POS #${item.trxId}`,
          createdBy: authResult.user?.username ?? null,
        });
      }
      if (item.channel === 'POS') {
        // Jurnal pembalik sebagian: kas keluar ke akun kas yang dipakai saat penjualan, persediaan kembali
        const asal = await barisJurnalAktif(tx, item.trxId, ['VERIFIKASI', 'POS']);
        const barisKas =
          asal.find((b) => b.akunKode === AKUN.KAS_SALES && Number(b.debit) > 0) ??
          asal.find((b) => AKUN_KAS.includes(b.akunKode) && Number(b.debit) > 0);
        const kas = barisKas?.akunKode ?? AKUN.KAS_TUNAI;
        const bruto = rp(Number(item.hargaJual ?? 0) * item.qty);
        const neto = rp(total);
        const hpp = rp(Number(item.hpp ?? 0));
        if (kas === AKUN.KAS_SALES && barisKas?.sales && neto > 0) {
          await tanggungKantor(tx, { divisi: item.divisi, cabang: item.cabang, referensi: item.trxId, user }, barisKas.sales, neto);
        }
        await posting(tx, {
          tanggal: new Date(),
          divisi: item.divisi,
          cabang: item.cabang,
          sumber: 'BATAL_POS',
          referensi: item.trxId,
          keterangan: `Batal item ${item.sku} x${item.qty} dari #${item.trxId}`,
          user,
          baris: [
            { akun: AKUN.PENJUALAN_POS, debit: bruto },
            { akun: AKUN.POTONGAN_PENJUALAN, kredit: rp(bruto - neto) },
            { akun: kas, kredit: neto, sales: barisKas?.sales ?? null },
            { akun: AKUN.PERSEDIAAN, debit: hpp },
            { akun: AKUN.HPP, kredit: hpp },
          ],
        });
      }

      await tx.insert(logs).values({
        user,
        aksi: 'BATAL_BARANG_KELUAR',
        detail: `Membatalkan item ${item.sku} (${item.qty} ${item.satuan}) dari transaksi ${item.trxId}`,
      });
      return null;
    });

    if (batalFaktur) {
      return NextResponse.json({
        success: true,
        message: `Faktur ${batalFaktur.faktur.noFaktur} dibatalkan: ${batalFaktur.rows.length} barang dikembalikan ke stok`,
      });
    }
    return NextResponse.json({ success: true, message: 'Data berhasil dihapus dan stok dikembalikan' });
  } catch (err) {
    return errorResponse(err, 'BARANG_KELUAR_DELETE');
  }
}
