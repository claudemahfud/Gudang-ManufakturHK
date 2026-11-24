// ============================================================
// TYPES — Shared TypeScript types seluruh aplikasi
// ============================================================

// User & Auth
export type UserRole =
  | 'Administrator'
  | 'Direktur Utama'
  | 'Manager'
  | 'Manager Umum'
  | 'Finance & Accounting'
  | 'Kepala Gudang'
  | 'Wakil Gudang'
  | 'Staff Gudang'
  | 'Kepala Expedisi'
  | 'Staff Expedisi'
  | 'Salesman'
  | 'Sales Canvas'
  | 'Sales Motoris'
  | 'Admin Salesman'
  | 'Staff Admin Salesman'
  | 'Agen'
  | 'Sales Agent'
  | 'Admin Agen'
  | 'Staff Admin Agen';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  /** Role utama + role tambahan. */
  roles?: UserRole[];
}

// Inventory
export interface InventoryItem {
  id: string;
  sku: string;
  namaBarang: string;
  brand?: string | null;
  gramasi?: string | null;
  varian?: string | null;
  stok: number;
  hargaBeli?: string | null;
  hargaJual?: string | null;
  supplier?: string | null;
  settingPcs: number;
  pakaiKarton: boolean;
  stokMinimum?: number | null;
  keterangan?: string | null;
  divisi?: 'MANUFAKTUR' | 'FNB';
  tipeItem?: 'barang_jadi' | 'bahan_baku' | 'kemasan' | 'menu_olahan';
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// Barang Masuk
export interface BarangMasukItem {
  id: string;
  tanggal: Date;
  sku: string;
  namaBarang: string;
  qty: number;
  satuan: string;
  hargaBeli?: string | null;
  totalBeli?: string | null;
  supplier: string;
  noFaktur?: string | null;
  skemaBayar?: 'lunas' | 'hutang';
  jatuhTempo?: Date | string | null;
  keterangan?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
}

// Supplier
export interface SupplierItem {
  id: string;
  nama: string;
  telepon?: string | null;
  alamat?: string | null;
  email?: string | null;
  keterangan?: string | null;
  aktif?: boolean;
  totalHutangAktif?: number;
}

// Barang Keluar
export interface BarangKeluarItem {
  id: string;
  trxId: string;
  tanggal: Date;
  sku: string;
  namaBarang: string;
  qty: number;
  satuan: string;
  hargaJual?: string | null;
  total?: string | null;
  pelanggan?: string | null;
  salesman?: string | null;
  diskon?: string | null;
  keterangan?: string | null;
  createdBy?: string | null;
  createdAt?: Date | null;
}

// Kontak
export interface KontakItem {
  id: string;
  nama: string;
  tipe: 'pelanggan' | 'supplier' | 'keduanya';
  telepon?: string | null;
  alamat?: string | null;
  email?: string | null;
  keterangan?: string | null;
  aktif: boolean;
}

// API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Dashboard
export interface DashboardStats {
  totalInventory: number;
  totalSKU: number;
  stokKritis: number;
  barangMasukHariIni: number;
  barangKeluarHariIni: number;
  nilaiInventory: string;
}
