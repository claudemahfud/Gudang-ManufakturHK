// Status PO Loading. PO hanya dokumen pemesanan; stok bertambah lewat Faktur Pembelian di Barang Masuk.
export const PO_STATUS = {
  PROSES: 'dipesan', // PO terkirim ke suplier, menunggu barang datang
  SEBAGIAN: 'sebagian', // sebagian barang sudah datang (faktur parsial)
  SELESAI: 'selesai', // semua barang sudah diterima
  BATAL: 'dibatalkan',
} as const;

export type PoStatus = (typeof PO_STATUS)[keyof typeof PO_STATUS];

/** PO yang masih menunggu barang datang (tampil di daftar Barang Masuk). */
export const isPoTerbuka = (status: string) => status === PO_STATUS.PROSES || status === PO_STATUS.SEBAGIAN;

export const PO_STATUS_LABEL: Record<string, string> = {
  [PO_STATUS.PROSES]: 'Proses',
  [PO_STATUS.SEBAGIAN]: 'Datang Sebagian',
  [PO_STATUS.SELESAI]: 'Selesai',
  [PO_STATUS.BATAL]: 'Dibatalkan',
  draft: 'Draft',
};
