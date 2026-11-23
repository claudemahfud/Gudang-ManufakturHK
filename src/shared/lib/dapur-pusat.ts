import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import {
  inventory,
  logs,
  produksi,
  produksiBahan,
  resepBiaya,
  resepHeader,
  resepItems,
  stokCabang,
} from '@/shared/lib/db/schema';
import { BusinessError, decrementStock, incrementStock, normalizeSku } from '@/shared/lib/stock';
import { evaluasiHarga, hitungHpp, pemakaianBahan } from '@/shared/lib/resep-hitung';
import { generateTrxId } from '@/shared/lib/utils';

// ============================================================
// Dapur Pusat: Master Resep (HPP per batch) & Produksi.
// Dapur Pusat = cabang 'Pusat'. Lihat docs/PRD-dapur-pusat-franchise.md.
// ============================================================

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

export const DAPUR_PUSAT = 'Pusat';

export interface ResepInput {
  menuSku: string;
  hasilQty: number;
  catatan: string | null;
  bahan: { sku: string; takaran: number; jenis: 'bahan' | 'kemasan' }[];
  biaya: { nama: string; jumlah: number }[];
  hargaFranchise: number;
  hargaJual: number;
}

/** Resep lengkap satu produk + HPP dari harga beli bahan saat ini. null bila produk tidak ada. */
export async function ambilResep(ex: Executor, menuSku: string) {
  const [produk] = await ex.select().from(inventory).where(eq(inventory.sku, menuSku)).limit(1);
  if (!produk) return null;
  const [header] = await ex.select().from(resepHeader).where(eq(resepHeader.menuSku, menuSku)).limit(1);
  const items = await ex.select().from(resepItems).where(eq(resepItems.menuSku, menuSku));
  const biaya = await ex.select().from(resepBiaya).where(eq(resepBiaya.menuSku, menuSku));
  const skus = items.map((i) => i.bahanSku);
  const master = skus.length
    ? await ex
        .select({
          sku: inventory.sku,
          namaBarang: inventory.namaBarang,
          hargaBeli: inventory.hargaBeli,
          stokPusat: stokCabang.stok,
        })
        .from(inventory)
        .leftJoin(stokCabang, and(eq(stokCabang.sku, inventory.sku), eq(stokCabang.cabang, DAPUR_PUSAT)))
        .where(inArray(inventory.sku, skus))
    : [];
  const hargaOf = (sku: string) => Number(master.find((m) => m.sku === sku)?.hargaBeli ?? 0);

  const bahan = items.map((i) => {
    const harga = hargaOf(i.bahanSku);
    const takaran = Number(i.takaran);
    return {
      id: i.id,
      sku: i.bahanSku,
      namaBahan: master.find((m) => m.sku === i.bahanSku)?.namaBarang ?? i.namaBahan,
      takaran,
      satuan: i.satuan,
      jenis: i.jenis,
      harga,
      subtotal: Math.round(takaran * harga * 100) / 100,
      stokPusat: master.find((m) => m.sku === i.bahanSku)?.stokPusat ?? 0,
    };
  });
  const hasilQty = header?.hasilQty ?? 1;
  const hpp = hitungHpp(
    hasilQty,
    bahan,
    biaya.map((b) => ({ jumlah: Number(b.jumlah) }))
  );
  const hargaFranchise = Number(produk.hargaFranchise ?? 0);
  const hargaJual = Number(produk.hargaJual ?? 0);
  return {
    produk: {
      sku: produk.sku,
      namaBarang: produk.namaBarang,
      brand: produk.brand,
      tipeItem: produk.tipeItem,
      hargaBeli: Number(produk.hargaBeli ?? 0),
      hargaFranchise,
      hargaJual,
    },
    punyaResep: items.length > 0,
    hasilQty,
    catatan: header?.catatan ?? null,
    bahan,
    biaya: biaya.map((b) => ({ id: b.id, nama: b.nama, jumlah: Number(b.jumlah) })),
    hpp,
    evaluasi: evaluasiHarga(hpp.hppPerUnit, hargaFranchise, hargaJual),
  };
}

/** Simpan resep (ganti seluruh bahan & biaya) + harga franchise / harga jual produk. */
export async function simpanResep(tx: Tx, r: ResepInput, user: string) {
  const menuSku = normalizeSku(r.menuSku);
  const [produk] = await tx
    .select({ sku: inventory.sku, namaBarang: inventory.namaBarang, divisi: inventory.divisi })
    .from(inventory)
    .where(eq(inventory.sku, menuSku))
    .limit(1);
  if (!produk) throw new BusinessError(`Produk ${menuSku} tidak ditemukan`, 404);
  if (produk.divisi !== 'FNB') throw new BusinessError('Resep Dapur Pusat hanya untuk produk F&B');

  const hasilQty = Number(r.hasilQty);
  if (!Number.isInteger(hasilQty) || hasilQty < 1) throw new BusinessError('Hasil per batch minimal 1 unit');
  if (!(r.hargaFranchise >= 0) || !(r.hargaJual >= 0)) throw new BusinessError('Harga tidak valid');

  const bahanSku = r.bahan.map((b) => normalizeSku(b.sku));
  if (bahanSku.some((s) => !s)) throw new BusinessError('SKU bahan wajib diisi');
  if (new Set(bahanSku).size !== bahanSku.length) throw new BusinessError('Bahan yang sama tercantum dua kali');
  if (bahanSku.includes(menuSku)) throw new BusinessError('Produk tidak boleh menjadi bahan dirinya sendiri');
  if (r.bahan.some((b) => !(Number(b.takaran) > 0))) throw new BusinessError('Takaran bahan harus lebih dari 0');
  if (r.biaya.some((b) => !b.nama?.trim() || !(Number(b.jumlah) >= 0)))
    throw new BusinessError('Nama dan jumlah biaya lain wajib diisi');

  const master = bahanSku.length
    ? await tx
        .select({ sku: inventory.sku, namaBarang: inventory.namaBarang })
        .from(inventory)
        .where(inArray(inventory.sku, bahanSku))
    : [];
  const hilang = bahanSku.filter((s) => !master.some((m) => m.sku === s));
  if (hilang.length) throw new BusinessError(`Bahan tidak ditemukan: ${hilang.join(', ')}`, 404);

  await tx.delete(resepItems).where(eq(resepItems.menuSku, menuSku));
  await tx.delete(resepBiaya).where(eq(resepBiaya.menuSku, menuSku));
  if (r.bahan.length) {
    await tx.insert(resepItems).values(
      r.bahan.map((b, i) => ({
        menuSku,
        bahanSku: bahanSku[i],
        namaBahan: master.find((m) => m.sku === bahanSku[i])!.namaBarang,
        takaran: String(Number(b.takaran)),
        satuan: 'satuan stok',
        jenis: b.jenis === 'kemasan' ? 'kemasan' : 'bahan',
      }))
    );
  }
  if (r.biaya.length) {
    await tx
      .insert(resepBiaya)
      .values(r.biaya.map((b) => ({ menuSku, nama: b.nama.trim(), jumlah: String(Number(b.jumlah)) })));
  }
  await tx
    .insert(resepHeader)
    .values({ menuSku, hasilQty, catatan: r.catatan, updatedBy: user, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: resepHeader.menuSku,
      set: { hasilQty, catatan: r.catatan, updatedBy: user, updatedAt: new Date() },
    });
  await tx
    .update(inventory)
    .set({ hargaFranchise: String(r.hargaFranchise), hargaJual: String(r.hargaJual), updatedAt: new Date() })
    .where(eq(inventory.sku, menuSku));

  const hasil = await ambilResep(tx, menuSku);
  await tx.insert(logs).values({
    user,
    aksi: 'SIMPAN_RESEP',
    detail: `Resep ${produk.namaBarang} (${menuSku}): hasil ${hasilQty}/batch, ${r.bahan.length} bahan, ${r.biaya.length} biaya lain, HPP Rp ${hasil!.hpp.hppPerUnit.toLocaleString('id-ID')}/unit, harga franchise Rp ${r.hargaFranchise.toLocaleString('id-ID')}`,
  });
  return hasil!;
}

/**
 * Produksi di Dapur Pusat: potong bahan, tambah produk jadi, simpan jejak HPP,
 * perbarui harga beli produk (rata-rata tertimbang, sama seperti Barang Masuk).
 */
export async function buatProduksi(
  tx: Tx,
  p: { menuSku: string; jumlahBatch: number; catatan: string | null },
  user: string
) {
  const menuSku = normalizeSku(p.menuSku);
  const jumlahBatch = Number(p.jumlahBatch);
  if (!Number.isInteger(jumlahBatch) || jumlahBatch < 1 || jumlahBatch > 10000)
    throw new BusinessError('Jumlah batch harus bilangan bulat 1 - 10.000');

  // Kunci baris produk: dua produksi bersamaan menghitung HPP rata-rata berurutan
  const [produk] = await tx.select().from(inventory).where(eq(inventory.sku, menuSku)).for('update').limit(1);
  if (!produk) throw new BusinessError(`Produk ${menuSku} tidak ditemukan`, 404);

  const resep = await ambilResep(tx, menuSku);
  if (!resep?.punyaResep) throw new BusinessError(`Produk ${produk.namaBarang} belum punya resep`);

  const hasilQty = resep.hasilQty * jumlahBatch;
  const pemakaian = resep.bahan.map((b) => {
    const qty = pemakaianBahan(b.takaran, jumlahBatch);
    return { ...b, qty, subtotalAktual: Math.round(qty * b.harga * 100) / 100 };
  });
  // Biaya aktual = bahan sesuai pemakaian (sudah dibulatkan) + biaya lain × batch
  const biayaBahan = Math.round(pemakaian.reduce((s, b) => s + b.subtotalAktual, 0) * 100) / 100;
  const biayaLain = Math.round(resep.hpp.biayaLain * jumlahBatch * 100) / 100;
  const hppTotal = Math.round((biayaBahan + biayaLain) * 100) / 100;
  const hppPerUnit = Math.round((hppTotal / hasilQty) * 100) / 100;

  for (const b of pemakaian) await decrementStock(tx, b.sku, b.qty, DAPUR_PUSAT);

  // Rata-rata tertimbang harga beli produk jadi (stok lama × harga lama + hasil × HPP)
  const stokLama = Math.max(0, Number(produk.stok) || 0);
  const hargaLama = Number(produk.hargaBeli ?? 0);
  const hargaBaru =
    stokLama > 0 && hargaLama > 0
      ? Math.round(((stokLama * hargaLama + hasilQty * hppPerUnit) / (stokLama + hasilQty)) * 100) / 100
      : hppPerUnit;
  await incrementStock(tx, menuSku, hasilQty, DAPUR_PUSAT);
  await tx.update(inventory).set({ hargaBeli: String(hargaBaru), updatedAt: new Date() }).where(eq(inventory.sku, menuSku));

  const noProduksi = generateTrxId('PRD');
  const [row] = await tx
    .insert(produksi)
    .values({
      noProduksi,
      tanggal: new Date(),
      menuSku,
      namaBarang: produk.namaBarang,
      jumlahBatch,
      hasilQty,
      biayaBahan: String(biayaBahan),
      biayaLain: String(biayaLain),
      hppTotal: String(hppTotal),
      hppPerUnit: String(hppPerUnit),
      cabang: DAPUR_PUSAT,
      catatan: p.catatan,
      createdBy: user,
    })
    .returning();
  await tx.insert(produksiBahan).values(
    pemakaian.map((b) => ({
      produksiId: row.id,
      bahanSku: b.sku,
      namaBahan: b.namaBahan,
      qty: b.qty,
      harga: String(b.harga),
      subtotal: String(b.subtotalAktual),
    }))
  );
  await tx.insert(logs).values({
    user,
    aksi: 'PRODUKSI_DAPUR',
    detail: `Produksi ${noProduksi}: ${jumlahBatch} batch ${produk.namaBarang} = ${hasilQty} unit, HPP Rp ${hppTotal.toLocaleString('id-ID')} (Rp ${hppPerUnit.toLocaleString('id-ID')}/unit), ${pemakaian.length} bahan dipotong dari ${DAPUR_PUSAT}`,
  });
  return { ...row, bahan: pemakaian };
}

export async function daftarProduksi(ex: Executor = db, limit = 100) {
  const rows = await ex.select().from(produksi).orderBy(desc(produksi.tanggal)).limit(limit);
  const ids = rows.map((r) => r.id);
  const bahan = ids.length ? await ex.select().from(produksiBahan).where(inArray(produksiBahan.produksiId, ids)) : [];
  return rows.map((r) => ({ ...r, bahan: bahan.filter((b) => b.produksiId === r.id) }));
}

/** Ringkasan semua produk F&B: punya resep atau tidak, HPP per unit, harga franchise & jual. */
export async function ringkasanResep(ex: Executor = db) {
  const produkFnb = await ex
    .select({ sku: inventory.sku })
    .from(inventory)
    .where(and(eq(inventory.divisi, 'FNB'), sql`${inventory.tipeItem} not in ('bahan_baku', 'kemasan')`));
  const hasil = [];
  // shortcut: beberapa query per produk; ganti ke query gabungan bila produk F&B > ~200
  for (const p of produkFnb) hasil.push(await ambilResep(ex, p.sku));
  return hasil.filter(Boolean).sort((a, b) => a!.produk.namaBarang.localeCompare(b!.produk.namaBarang));
}
