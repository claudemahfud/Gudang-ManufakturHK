// ============================================================
// Perhitungan HPP resep per batch (murni, tanpa DB).
// Dipakai formulir Master Resep (pratinjau) dan server (sumber kebenaran).
// ============================================================

export interface BahanResep {
  takaran: number; // per batch, dalam satuan stok bahan (gram/ml/pcs)
  harga: number; // harga beli bahan per satuan stok
}

export interface BiayaResep {
  jumlah: number; // rupiah per batch
}

export interface HasilHpp {
  biayaBahan: number; // per batch
  biayaLain: number; // per batch
  hppBatch: number;
  hppPerUnit: number;
}

const rp = (n: number) => Math.round(n * 100) / 100;
const aman = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function hitungHpp(hasilQty: number, bahan: BahanResep[], biaya: BiayaResep[]): HasilHpp {
  const biayaBahan = rp(bahan.reduce((s, b) => s + aman(b.takaran) * aman(b.harga), 0));
  const biayaLain = rp(biaya.reduce((s, b) => s + aman(b.jumlah), 0));
  const hppBatch = rp(biayaBahan + biayaLain);
  const hasil = Math.max(1, Math.floor(aman(hasilQty)));
  return { biayaBahan, biayaLain, hppBatch, hppPerUnit: rp(hppBatch / hasil) };
}

/** Pemakaian bahan untuk N batch, dibulatkan ke atas karena stok berupa bilangan bulat. */
export function pemakaianBahan(takaran: number, jumlahBatch: number): number {
  return Math.ceil(aman(takaran) * jumlahBatch - 1e-9);
}

/** Margin & food cost dari HPP per unit terhadap harga franchise dan harga jual konsumen. */
export function evaluasiHarga(hppPerUnit: number, hargaFranchise: number, hargaJual: number) {
  const persen = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  return {
    marginPusat: rp(hargaFranchise - hppPerUnit),
    marginPusatPersen: persen(hargaFranchise - hppPerUnit, hargaFranchise),
    marginFranchise: rp(hargaJual - hargaFranchise),
    marginFranchisePersen: persen(hargaJual - hargaFranchise, hargaJual),
    foodCostPersen: persen(hppPerUnit, hargaJual),
  };
}
