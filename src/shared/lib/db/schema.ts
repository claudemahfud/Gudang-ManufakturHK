import { pgTable, text, integer, boolean, timestamp, decimal, uuid, varchar, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// USERS
// ============================================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  namaLengkap: varchar('nama_lengkap', { length: 100 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  email: varchar('email', { length: 100 }),
  passwordHash: text('password_hash').notNull(),
  aktif: boolean('aktif').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================
// INVENTORY (Master Barang)
// ============================================================
export const inventory = pgTable('inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  sku: varchar('sku', { length: 50 }).notNull().unique(),
  namaBarang: varchar('nama_barang', { length: 150 }).notNull(),
  brand: varchar('brand', { length: 100 }),
  gramasi: varchar('gramasi', { length: 50 }),
  varian: varchar('varian', { length: 100 }),
  stok: integer('stok').notNull().default(0),
  hargaBeli: decimal('harga_beli', { precision: 15, scale: 2 }).default('0'),
  hargaJual: decimal('harga_jual', { precision: 15, scale: 2 }).default('0'),
  settingPcs: integer('setting_pcs').notNull().default(1),
  pakaiKarton: boolean('pakai_karton').notNull().default(true),
  stokMinimum: integer('stok_minimum').default(10),
  keterangan: text('keterangan'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================
// BARANG MASUK
// ============================================================
export const barangMasuk = pgTable('barang_masuk', {
  id: uuid('id').primaryKey().defaultRandom(),
  tanggal: timestamp('tanggal').notNull(),
  sku: varchar('sku', { length: 50 }).notNull(),
  namaBarang: varchar('nama_barang', { length: 150 }).notNull(),
  qty: integer('qty').notNull(),
  satuan: varchar('satuan', { length: 20 }).notNull().default('pcs'),
  hargaBeli: decimal('harga_beli', { precision: 15, scale: 2 }).default('0'),
  supplier: varchar('supplier', { length: 150 }),
  noFaktur: varchar('no_faktur', { length: 100 }),
  keterangan: text('keterangan'),
  createdBy: varchar('created_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// BARANG KELUAR
// ============================================================
export const barangKeluar = pgTable('barang_keluar', {
  id: uuid('id').primaryKey().defaultRandom(),
  trxId: varchar('trx_id', { length: 100 }).notNull(),
  tanggal: timestamp('tanggal').notNull(),
  sku: varchar('sku', { length: 50 }).notNull(),
  namaBarang: varchar('nama_barang', { length: 150 }).notNull(),
  qty: integer('qty').notNull(),
  satuan: varchar('satuan', { length: 20 }).notNull().default('pcs'),
  hargaJual: decimal('harga_jual', { precision: 15, scale: 2 }).default('0'),
  total: decimal('total', { precision: 15, scale: 2 }).default('0'),
  pelanggan: varchar('pelanggan', { length: 150 }),
  salesman: varchar('salesman', { length: 100 }),
  diskon: decimal('diskon', { precision: 5, scale: 2 }).default('0'),
  keterangan: text('keterangan'),
  createdBy: varchar('created_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// SURAT JALAN
// ============================================================
export const suratJalan = pgTable('surat_jalan', {
  id: uuid('id').primaryKey().defaultRandom(),
  noSj: varchar('no_sj', { length: 100 }).notNull().unique(),
  tanggal: timestamp('tanggal').notNull(),
  pelanggan: varchar('pelanggan', { length: 150 }).notNull(),
  alamat: text('alamat'),
  ekspedisi: varchar('ekspedisi', { length: 100 }),
  armada: varchar('armada', { length: 50 }),
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  catatan: text('catatan'),
  createdBy: varchar('created_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const suratJalanItems = pgTable('surat_jalan_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  suratJalanId: uuid('surat_jalan_id').notNull().references(() => suratJalan.id, { onDelete: 'cascade' }),
  sku: varchar('sku', { length: 50 }).notNull(),
  namaBarang: varchar('nama_barang', { length: 150 }).notNull(),
  qty: integer('qty').notNull(),
  satuan: varchar('satuan', { length: 20 }).notNull().default('pcs'),
  keterangan: text('keterangan'),
});

// ============================================================
// PO LOADING
// ============================================================
export const poLoading = pgTable('po_loading', {
  id: uuid('id').primaryKey().defaultRandom(),
  noPo: varchar('no_po', { length: 100 }).notNull().unique(),
  tanggal: timestamp('tanggal').notNull(),
  supplier: varchar('supplier', { length: 150 }),
  armada: varchar('armada', { length: 50 }),
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  catatan: text('catatan'),
  createdBy: varchar('created_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const poLoadingItems = pgTable('po_loading_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  poLoadingId: uuid('po_loading_id').notNull().references(() => poLoading.id, { onDelete: 'cascade' }),
  sku: varchar('sku', { length: 50 }).notNull(),
  namaBarang: varchar('nama_barang', { length: 150 }).notNull(),
  qtyOrder: integer('qty_order').notNull().default(0),
  qtyTerima: integer('qty_terima').notNull().default(0),
  satuan: varchar('satuan', { length: 20 }).notNull().default('pcs'),
});

// ============================================================
// RETUR BARANG
// ============================================================
export const returBarang = pgTable('retur_barang', {
  id: uuid('id').primaryKey().defaultRandom(),
  tanggal: timestamp('tanggal').notNull(),
  sku: varchar('sku', { length: 50 }).notNull(),
  namaBarang: varchar('nama_barang', { length: 150 }).notNull(),
  qty: integer('qty').notNull(),
  alasan: text('alasan'),
  pelanggan: varchar('pelanggan', { length: 150 }),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  createdBy: varchar('created_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// BARANG RUSAK
// ============================================================
export const barangRusak = pgTable('barang_rusak', {
  id: uuid('id').primaryKey().defaultRandom(),
  tanggal: timestamp('tanggal').notNull(),
  sku: varchar('sku', { length: 50 }).notNull(),
  namaBarang: varchar('nama_barang', { length: 150 }).notNull(),
  qty: integer('qty').notNull(),
  keterangan: text('keterangan'),
  createdBy: varchar('created_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// MUTASI BARANG
// ============================================================
export const mutasiBarang = pgTable('mutasi_barang', {
  id: uuid('id').primaryKey().defaultRandom(),
  tanggal: timestamp('tanggal').notNull(),
  sku: varchar('sku', { length: 50 }).notNull(),
  namaBarang: varchar('nama_barang', { length: 150 }).notNull(),
  qty: integer('qty').notNull(),
  dari: varchar('dari', { length: 100 }).notNull(),
  ke: varchar('ke', { length: 100 }).notNull(),
  keterangan: text('keterangan'),
  createdBy: varchar('created_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// KONTAK (Pelanggan / Supplier)
// ============================================================
export const kontak = pgTable('kontak', {
  id: uuid('id').primaryKey().defaultRandom(),
  nama: varchar('nama', { length: 150 }).notNull(),
  tipe: varchar('tipe', { length: 20 }).notNull().default('pelanggan'), // pelanggan | supplier | keduanya
  telepon: varchar('telepon', { length: 30 }),
  alamat: text('alamat'),
  email: varchar('email', { length: 100 }),
  keterangan: text('keterangan'),
  aktif: boolean('aktif').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================
// ARMADA (Kendaraan Expedisi)
// ============================================================
export const armada = pgTable('armada', {
  id: uuid('id').primaryKey().defaultRandom(),
  nopol: varchar('nopol', { length: 20 }).notNull().unique(),
  jenis: varchar('jenis', { length: 50 }),
  kapasitas: varchar('kapasitas', { length: 50 }),
  status: varchar('status', { length: 20 }).notNull().default('aktif'),
  keterangan: text('keterangan'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// KEUANGAN
// ============================================================
export const keuangan = pgTable('keuangan', {
  id: uuid('id').primaryKey().defaultRandom(),
  tanggal: timestamp('tanggal').notNull(),
  jenis: varchar('jenis', { length: 20 }).notNull(), // masuk | keluar
  kategori: varchar('kategori', { length: 100 }).notNull(),
  jumlah: decimal('jumlah', { precision: 15, scale: 2 }).notNull(),
  keterangan: text('keterangan'),
  createdBy: varchar('created_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// BIAYA OPERASIONAL
// ============================================================
export const biayaOperasional = pgTable('biaya_operasional', {
  id: uuid('id').primaryKey().defaultRandom(),
  tanggal: timestamp('tanggal').notNull(),
  kategori: varchar('kategori', { length: 100 }).notNull(),
  jumlah: decimal('jumlah', { precision: 15, scale: 2 }).notNull(),
  keterangan: text('keterangan'),
  createdBy: varchar('created_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// DISKON REQUEST
// ============================================================
export const diskonRequest = pgTable('diskon_request', {
  id: uuid('id').primaryKey().defaultRandom(),
  tanggal: timestamp('tanggal').notNull(),
  salesman: varchar('salesman', { length: 100 }).notNull(),
  pelanggan: varchar('pelanggan', { length: 150 }).notNull(),
  sku: varchar('sku', { length: 50 }),
  namaBarang: varchar('nama_barang', { length: 150 }),
  qty: integer('qty'),
  diskonPct: decimal('diskon_pct', { precision: 5, scale: 2 }),
  alasan: text('alasan'),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | approved | rejected
  approvedBy: varchar('approved_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================
// TARGET KOMISI
// ============================================================
export const targetKomisi = pgTable('target_komisi', {
  id: uuid('id').primaryKey().defaultRandom(),
  salesman: varchar('salesman', { length: 100 }).notNull(),
  periode: varchar('periode', { length: 10 }).notNull(), // YYYY-MM
  target: decimal('target', { precision: 15, scale: 2 }).notNull().default('0'),
  realisasi: decimal('realisasi', { precision: 15, scale: 2 }).notNull().default('0'),
  pctKomisi: decimal('pct_komisi', { precision: 5, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================
// LOGS (Audit Trail)
// ============================================================
export const logs = pgTable('logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tanggal: timestamp('tanggal').defaultNow(),
  user: varchar('user', { length: 50 }),
  aksi: varchar('aksi', { length: 100 }).notNull(),
  detail: text('detail'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// OTP CODES
// ============================================================
export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 100 }).notNull(),
  otpHash: text('otp_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// NOTIF SISTEM
// ============================================================
export const notifSistem = pgTable('notif_sistem', {
  id: uuid('id').primaryKey().defaultRandom(),
  judul: varchar('judul', { length: 200 }).notNull(),
  pesan: text('pesan').notNull(),
  tipe: varchar('tipe', { length: 30 }).notNull().default('info'), // info | warning | error | success
  isRead: boolean('is_read').notNull().default(false),
  userId: uuid('user_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// STOK FISIK
// ============================================================
export const stokFisikSesi = pgTable('stok_fisik_sesi', {
  id: uuid('id').primaryKey().defaultRandom(),
  tanggal: timestamp('tanggal').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('open'), // open | closed
  createdBy: varchar('created_by', { length: 50 }),
  closedAt: timestamp('closed_at'),
});

export const stokFisik = pgTable('stok_fisik', {
  id: uuid('id').primaryKey().defaultRandom(),
  sesiId: uuid('sesi_id').notNull().references(() => stokFisikSesi.id, { onDelete: 'cascade' }),
  sku: varchar('sku', { length: 50 }).notNull(),
  namaBarang: varchar('nama_barang', { length: 150 }).notNull(),
  stokSistem: integer('stok_sistem').notNull().default(0),
  stokFisikAktual: integer('stok_fisik_aktual').notNull().default(0),
  selisih: integer('selisih').notNull().default(0),
  keterangan: text('keterangan'),
});
