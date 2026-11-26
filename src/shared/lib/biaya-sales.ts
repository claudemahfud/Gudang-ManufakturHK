// Biaya operasional yang boleh memotong setoran penjual. Hanya akun beban operasional sales:
// gaji, sewa, listrik, penyusutan, dan HPP (5-xxxx) tidak termasuk. Aman dipakai di browser.
export const AKUN_BIAYA_SALES = [
  { kode: '6-1400', nama: 'Transportasi & Pengiriman (bensin, parkir, tol)' },
  { kode: '6-1500', nama: 'Pemasaran' },
  { kode: '6-1600', nama: 'Perlengkapan & ATK' },
  { kode: '6-1700', nama: 'Pemeliharaan (servis kendaraan)' },
  { kode: '6-1900', nama: 'Operasional Lain (uang makan, dll.)' },
] as const;

export const MAKS_BARIS_BIAYA = 20;

export interface BiayaSetoran {
  akun: string;
  jumlah: number;
  keterangan: string;
}

export const namaAkunBiaya = (kode: string) => AKUN_BIAYA_SALES.find((a) => a.kode === kode)?.nama ?? kode;
