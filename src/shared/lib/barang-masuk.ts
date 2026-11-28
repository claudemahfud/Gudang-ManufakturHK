import { eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { barangMasuk, hutangSupplier, inventory, keuangan } from '@/shared/lib/db/schema';
import { BusinessError, incrementStock } from '@/shared/lib/stock';
import { AKUN, posting } from '@/shared/lib/jurnal';
import { nomorUrut } from '@/shared/lib/nomor-urut';

// ============================================================
// Pencatatan Barang Masuk (dipakai Barang Masuk manual & Faktur Pembelian dari PO)
// Satu jalur: catatan barang_masuk + HPP rata-rata + stok cabang.
// Pembayaran (kas lunas / hutang supplier) dicatat terpisah per faktur.
// ============================================================

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface BarangMasukInput {
  tanggal: Date;
  sku: string; // sudah dinormalisasi (trim + upper)
  namaBarang: string;
  qty: number;
  satuan: string;
  hargaBeli: number;
  supplier: string;
  noFaktur: string | null;
  skemaBayar: 'lunas' | 'hutang';
  jatuhTempo: Date | null;
  divisi: string;
  cabang: string;
  keterangan: string | null;
  diterimaOleh?: string | null;
  fotoPenerimaan?: string | null;
  user: string;
  /** Isi per karton dari form, dipakai (dan disimpan ke master) bila master belum punya */
  isiKarton?: number | null;
}

const ALIAS_KARTON = ['karton', 'krt', 'ctn', 'dus', 'dos', 'box'];

/**
 * Ubah qty & harga dari satuan input ke satuan dasar stok (pcs).
 * Karton memakai isi per karton dari Master Barang (setting_pcs); satuan lain belum punya konversi.
 */
export function konversiKePcs(
  satuan: string | null | undefined,
  qty: number,
  hargaBeli: number,
  inv: { pakaiKarton: boolean; settingPcs: number } | null | undefined,
  isiInput?: number | null
) {
  const s = String(satuan || 'pcs').trim().toLowerCase();
  if (s === 'pcs' || s === '') return { qtyPcs: qty, hargaPcs: hargaBeli, isi: 1, label: 'pcs' };
  if (ALIAS_KARTON.includes(s)) {
    // Isi master menang; isi dari form hanya untuk barang yang belum punya setting karton
    const isiMaster = inv?.pakaiKarton ? Number(inv.settingPcs) || 1 : 1;
    const isiForm = Math.floor(Number(isiInput) || 0);
    const isi = isiMaster > 1 ? isiMaster : isiForm;
    if (!Number.isFinite(isi) || isi <= 1) {
      throw new BusinessError('Isi per karton belum diatur. Isi jumlah pcs per karton (minimal 2), atau catat dalam pcs.');
    }
    return { qtyPcs: qty * isi, hargaPcs: hargaBeli / isi, isi, label: 'karton' };
  }
  throw new BusinessError(`Satuan "${satuan}" belum punya konversi ke pcs. Gunakan pcs atau karton.`);
}

/** Catat satu baris barang masuk, perbarui HPP rata-rata tertimbang, tambah stok cabang. */
export async function catatBarangMasuk(tx: Tx, input: BarangMasukInput) {
  // Nilai pembelian mengikuti satuan input (mis. 1 karton x Rp 15.000)
  const totalBeli = input.qty * input.hargaBeli;

  // FOR UPDATE: dua penerimaan bersamaan antre, sehingga rata-rata HPP
  // dihitung dari stok & harga terbaru, bukan nilai basi.
  const [existingInv] = await tx
    .select()
    .from(inventory)
    .where(eq(inventory.sku, input.sku))
    .for('update')
    .limit(1);

  // Stok & HPP selalu disimpan per pcs; catatan menyimpan qty/harga per pcs
  const k = konversiKePcs(input.satuan, input.qty, input.hargaBeli, existingInv, input.isiKarton);
  // Master belum punya isi karton: simpan isi dari form agar transaksi berikutnya konsisten
  const simpanIsiKeMaster = k.isi > 1 && !(existingInv?.pakaiKarton && Number(existingInv.settingPcs) > 1);
  const catatanSatuan =
    k.isi > 1
      ? `Input: ${input.qty} karton (isi ${k.isi} pcs) @ Rp ${input.hargaBeli.toLocaleString('id-ID')}/karton`
      : null;
  const { isiKarton: _isi, ...sisaInput } = input;
  void _isi;
  const it = {
    ...sisaInput,
    qty: k.qtyPcs,
    satuan: 'pcs',
    hargaBeli: Math.round(k.hargaPcs * 100) / 100,
    keterangan: [catatanSatuan, input.keterangan].filter(Boolean).join(' · ') || null,
  };

  const [row] = await tx
    .insert(barangMasuk)
    .values({
      tanggal: it.tanggal,
      sku: it.sku,
      namaBarang: it.namaBarang,
      qty: it.qty,
      satuan: it.satuan,
      hargaBeli: String(it.hargaBeli),
      totalBeli: String(totalBeli),
      supplier: it.supplier,
      noFaktur: it.noFaktur,
      skemaBayar: it.skemaBayar,
      jatuhTempo: it.jatuhTempo,
      divisi: it.divisi,
      cabang: it.cabang,
      keterangan: it.keterangan,
      diterimaOleh: it.diterimaOleh || it.user.slice(0, 100),
      fotoPenerimaan: it.fotoPenerimaan || null,
      createdBy: it.user,
    })
    .returning();

  if (existingInv) {
    // Moving Weighted Average Cost (rata-rata tertimbang)
    const curStock = Number(existingInv.stok) || 0;
    const curPrice = parseFloat(existingInv.hargaBeli as string) || it.hargaBeli;
    const newStock = curStock + it.qty;

    let finalHargaBeli = it.hargaBeli;
    if (newStock > 0 && curStock > 0 && it.hargaBeli > 0) {
      finalHargaBeli = Math.round(((curStock * curPrice + it.qty * it.hargaBeli) / newStock) * 100) / 100;
    } else if (it.hargaBeli <= 0) {
      finalHargaBeli = curPrice;
    }

    await tx
      .update(inventory)
      .set({
        hargaBeli: String(finalHargaBeli),
        supplier: it.supplier,
        ...(simpanIsiKeMaster ? { pakaiKarton: true, settingPcs: k.isi } : {}),
        updatedAt: new Date(),
      })
      .where(eq(inventory.sku, it.sku));
  } else {
    await tx.insert(inventory).values({
      sku: it.sku,
      namaBarang: it.namaBarang,
      stok: 0, // diisi incrementStock di bawah
      hargaBeli: String(it.hargaBeli),
      hargaJual: '0',
      supplier: it.supplier,
      divisi: it.divisi,
      cabang: it.cabang,
      tipeItem: it.divisi === 'FNB' ? 'bahan_baku' : 'barang_jadi',
      pakaiKarton: k.isi > 1,
      settingPcs: k.isi > 1 ? k.isi : 1,
    });
  }

  // Stok masuk ke cabang penerima (stok_cabang + total inventory)
  await incrementStock(tx, it.sku, it.qty, it.cabang);

  return { row, totalBeli };
}

export interface PembayaranPembelianInput {
  tanggal: Date;
  total: number;
  supplier: string;
  noFaktur: string | null;
  skemaBayar: 'lunas' | 'hutang';
  jatuhTempo: Date | null;
  divisi: string;
  cabang: string;
  uraian: string; // ringkasan barang untuk keterangan kas / catatan hutang
  user: string;
}

/**
 * Lunas = kas keluar; hutang = kewajiban di Hutang Supplier (neraca).
 * Jurnal: Dr Persediaan / Cr Kas Tunai (lunas) atau Cr Hutang Usaha (kredit).
 */
export async function catatPembayaranPembelian(tx: Tx, p: PembayaranPembelianInput) {
  if (p.total <= 0) return;
  // Nomor faktur hutang wajib sama dengan barang_masuk.no_faktur (pembatalan mencari hutang lewat nomor ini)
  const noFaktur = p.noFaktur || (await nomorUrut(tx, 'BM', p.tanggal));

  if (p.skemaBayar === 'lunas') {
    await tx.insert(keuangan).values({
      tanggal: p.tanggal,
      jenis: 'keluar',
      kategori: 'Pembelian Barang Supplier',
      jumlah: String(p.total),
      divisi: p.divisi,
      cabang: p.cabang,
      keterangan: `Pembelian lunas ${p.uraian} dari suplier ${p.supplier}. Faktur: ${p.noFaktur || '-'}`,
      createdBy: p.user,
    });
  } else {
    await tx.insert(hutangSupplier).values({
      supplier: p.supplier,
      noFaktur,
      tanggal: p.tanggal,
      jatuhTempo: p.jatuhTempo,
      totalHutang: String(p.total),
      sisaHutang: String(p.total),
      status: 'belum_lunas',
      divisi: p.divisi,
      catatan: `Pengadaan barang masuk kredit ${p.uraian}`,
    });
  }

  await posting(tx, {
    tanggal: p.tanggal,
    divisi: p.divisi,
    cabang: p.cabang,
    sumber: 'PEMBELIAN',
    referensi: noFaktur,
    keterangan: `Pembelian ${p.skemaBayar === 'lunas' ? 'tunai' : 'kredit'} dari ${p.supplier}: ${p.uraian}`,
    user: p.user,
    baris: [
      { akun: AKUN.PERSEDIAAN, debit: p.total },
      { akun: p.skemaBayar === 'lunas' ? AKUN.KAS_TUNAI : AKUN.HUTANG_USAHA, kredit: p.total },
    ],
  });
}

/** Jatuh tempo default 30 hari untuk skema hutang; null untuk lunas. */
export function resolveJatuhTempo(skema: 'lunas' | 'hutang', tanggal: Date, jatuhTempo?: unknown): Date | null {
  if (skema !== 'hutang') return null;
  if (!jatuhTempo) return new Date(tanggal.getTime() + 30 * 24 * 60 * 60 * 1000);
  const jt = new Date(String(jatuhTempo));
  if (Number.isNaN(jt.getTime())) throw new BusinessError('Tanggal jatuh tempo tidak valid');
  return jt;
}
