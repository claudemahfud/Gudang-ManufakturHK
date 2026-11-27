// Aturan biaya operasional yang dipakai server & browser (tanpa impor database).

export const SUMBER_BIAYA = ['penjualan', 'kantor', 'pribadi'] as const;
export type SumberBiaya = (typeof SUMBER_BIAYA)[number];
export type StatusBiaya = 'menunggu' | 'disetujui' | 'ditolak' | 'dibatalkan' | 'dibayar';

export const LABEL_SUMBER_BIAYA: Record<SumberBiaya, string> = {
  penjualan: 'Uang penjualan (memotong setoran)',
  kantor: 'Kas / Bank kantor',
  pribadi: 'Uang pribadi (reimburse)',
};

/** Beban non-tunai / buatan sistem: tidak bisa diinput karyawan. HPP (5-xxxx) tidak disentuh. */
export const AKUN_BIAYA_DIKECUALIKAN = ['6-1800', '6-2100'];
export const bolehAkunBiaya = (kode: string) => kode.startsWith('6-') && !AKUN_BIAYA_DIKECUALIKAN.includes(kode);

export const MAKS_FOTO = 3;
export const MAKS_PANJANG_FOTO = 900_000; // karakter data URL (~650 KB)
export const POLA_FOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
/** PDF disimpan apa adanya; 3 berkas harus muat di batas kiriman server (±4,5 MB). */
export const MAKS_PANJANG_PDF = 1_300_000; // karakter data URL (~950 KB)
export const POLA_PDF = /^data:application\/pdf;base64,[A-Za-z0-9+/]+=*$/;
export const adalahPdf = (dataUrl: string) => dataUrl.startsWith('data:application/pdf;');

/** Label status yang dibaca pengguna: biaya pribadi yang disetujui berarti menunggu diganti. */
export function labelStatus(status: StatusBiaya, sumber: SumberBiaya) {
  if (status === 'menunggu') return 'Menunggu';
  if (status === 'ditolak') return 'Ditolak';
  if (status === 'dibatalkan') return 'Dibatalkan';
  if (status === 'dibayar') return 'Reimburse lunas';
  return sumber === 'pribadi' ? 'Belum direimburse' : 'Disetujui';
}

export interface ItemBiaya {
  id: string;
  noBiaya: string | null;
  tanggal: string;
  akunKode: string | null;
  kategori: string;
  jumlah: number;
  keterangan: string | null;
  sumber: SumberBiaya;
  metode: 'tunai' | 'transfer';
  status: StatusBiaya;
  username: string | null;
  nama: string | null;
  notaFisik: boolean;
  jumlahFoto: number;
  diprosesOleh: string | null;
  alasanTolak: string | null;
  reimburseOleh: string | null;
  reimburseAt: string | null;
  reimburseMetode: string | null;
  /** hanya di Laporan Operasional: pemirsa boleh memproses baris ini */
  bisaProses?: boolean;
}
