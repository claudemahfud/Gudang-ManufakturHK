// ============================================================
// ROUTES — Konstanta path terpusat (magic-string proof)
// 1 entry = 1 halaman = 1 folder di src/pages/
// ============================================================

export const ROUTES = {
  // Auth
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',

  // Core
  DASHBOARD: '/dashboard',
  INVENTORY: '/inventory',
  POS: '/pos',

  // Penjualan & Laporan POS / Gudang
  LAPORAN_PENJUALAN: '/laporan-penjualan',
  PRODUK_TERJUAL: '/produk-terjual',
  LAPORAN_RUSAK_RETUR: '/laporan-rusak-retur',

  // Gudang
  BARANG_MASUK: '/barang-masuk',
  BARANG_KELUAR: '/barang-keluar',
  BARANG_RUSAK: '/barang-rusak',
  MUTASI_BARANG: '/mutasi-barang',
  STOK_KRITIS: '/stok-kritis',

  // Dokumen
  SURAT_JALAN: '/surat-jalan',
  SURAT_JALAN_DETAIL: (id: string) => `/surat-jalan/${id}`,
  PO_LOADING: '/po-loading',
  RETUR_BARANG: '/retur-barang',

  // Keuangan
  KEUANGAN: '/keuangan',
  BIAYA_OPERASIONAL: '/biaya-operasional',

  // Salesman & Agen
  PENGAJUAN_DISKON: '/pengajuan-diskon',
  MONITOR_SALESMAN: '/monitor-salesman',
  TARGET_KOMISI: '/target-komisi',

  // Operasional
  EXPEDISI: '/expedisi',
  KONTAK: '/kontak',

  // Admin
  USERS: '/users',
  LOGS: '/logs',
} as const;
