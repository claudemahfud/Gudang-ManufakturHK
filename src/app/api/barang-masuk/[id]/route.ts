import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { barangMasuk, hutangSupplier, inventory, keuangan, logs, returBarang } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_WAREHOUSE } from '@/shared/lib/auth/rbac';
import { and, eq } from 'drizzle-orm';
import { BusinessError, decrementStock, errorResponse } from '@/shared/lib/stock';
import { batalkanReturPelanggan } from '@/shared/lib/retur-pelanggan';
import { AKUN, cabangFranchise, posting } from '@/shared/lib/jurnal';

const rp = (n: number) => Math.round(n * 100) / 100;

// ============================================================
// API: /api/barang-masuk/[id]
// DELETE barang masuk & rollback stok inventory
// Hak Akses: Divisi Gudang & Eksekutif
// ============================================================

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthRole(ROLES_WAREHOUSE);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const user = authResult.user?.name || authResult.user?.username || 'System';

    await db.transaction(async (tx) => {
      // Retur pelanggan: batalkan returnya utuh (stok, piutang, refund, catatan retur)
      const [retur] = await tx.select({ id: returBarang.id }).from(returBarang).where(eq(returBarang.barangMasukId, id)).limit(1);
      if (retur) {
        await batalkanReturPelanggan(tx, retur.id, user);
        return;
      }
      // Hapus & ambil barisnya dalam satu langkah (aman dari klik ganda)
      const [item] = await tx.delete(barangMasuk).where(eq(barangMasuk.id, id)).returning();
      if (!item) throw new BusinessError('Data barang masuk tidak ditemukan', 404);

      // Rollback stok; ditolak bila barangnya sudah terjual/terpakai
      try {
        await decrementStock(tx, item.sku, item.qty, item.cabang);
      } catch (e) {
        if (e instanceof BusinessError && e.status === 400) {
          throw new BusinessError(
            `Barang masuk tidak bisa dihapus: sebagian stok ${item.sku} sudah keluar. ${e.message}`
          );
        }
        throw e;
      }

      // Pembelian dibatalkan: kas lunas kembali / hutang suplier berkurang, persediaan keluar.
      // Cabang franchise: barang kiriman Dapur Pusat, bukan pembelian perusahaan.
      const nilaiBeli = rp(Number(item.totalBeli) || 0);
      if (nilaiBeli > 0 && !(await cabangFranchise(tx, item.cabang))) {
        let akunLawan: string = AKUN.KAS_TUNAI;
        if (item.skemaBayar === 'hutang') {
          const [h] = await tx
            .select()
            .from(hutangSupplier)
            .where(and(eq(hutangSupplier.supplier, item.supplier), eq(hutangSupplier.noFaktur, item.noFaktur ?? ''), eq(hutangSupplier.divisi, item.divisi)))
            .for('update')
            .limit(1);
          if (!h || Number(h.sisaHutang) + 0.009 < nilaiBeli) {
            throw new BusinessError(
              'Barang masuk tidak bisa dihapus: hutang fakturnya tidak ditemukan atau sudah dibayar. Catat retur ke suplier lewat Jurnal Manual.'
            );
          }
          const sisa = rp(Number(h.sisaHutang) - nilaiBeli);
          await tx
            .update(hutangSupplier)
            .set({ totalHutang: String(rp(Number(h.totalHutang) - nilaiBeli)), sisaHutang: String(sisa), status: sisa <= 0 ? 'lunas' : 'belum_lunas', updatedAt: new Date() })
            .where(eq(hutangSupplier.id, h.id));
          akunLawan = AKUN.HUTANG_USAHA;
        } else {
          await tx.insert(keuangan).values({
            tanggal: new Date(),
            jenis: 'masuk',
            kategori: 'Pembatalan Pembelian',
            jumlah: String(nilaiBeli),
            divisi: item.divisi,
            cabang: item.cabang,
            keterangan: `Pembatalan barang masuk ${item.sku} x${item.qty} dari ${item.supplier}. Faktur: ${item.noFaktur || '-'}`,
            createdBy: authResult.user?.username ?? null,
          });
        }
        // Persediaan keluar senilai HPP rata-rata saat ini; bedanya dengan harga beli = selisih persediaan
        const [inv] = await tx.select({ hargaBeli: inventory.hargaBeli }).from(inventory).where(eq(inventory.sku, item.sku)).limit(1);
        const nilaiKeluar = rp(item.qty * Number(inv?.hargaBeli ?? item.hargaBeli ?? 0));
        const selisih = rp(nilaiKeluar - nilaiBeli);
        await posting(tx, {
          tanggal: new Date(),
          divisi: item.divisi,
          cabang: item.cabang,
          sumber: 'BATAL_PEMBELIAN',
          referensi: item.noFaktur ?? item.id,
          keterangan: `Batal barang masuk ${item.sku} x${item.qty} dari ${item.supplier}`,
          user,
          baris: [
            { akun: akunLawan, debit: nilaiBeli },
            { akun: AKUN.PERSEDIAAN, kredit: nilaiKeluar },
            { akun: AKUN.SELISIH_PERSEDIAAN, debit: selisih > 0 ? selisih : 0, kredit: selisih < 0 ? -selisih : 0 },
          ],
        });
      }

      await tx.insert(logs).values({
        user,
        aksi: 'HAPUS_BARANG_MASUK',
        detail: `Menghapus barang masuk ID: ${id}, SKU: ${item.sku} (${item.qty} ${item.satuan})`,
      });
    });

    return NextResponse.json({ success: true, message: 'Data barang masuk berhasil dihapus' });
  } catch (err) {
    return errorResponse(err, 'BARANG_MASUK_DELETE');
  }
}
