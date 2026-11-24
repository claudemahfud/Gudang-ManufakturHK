import { pgTable, text, integer, boolean, timestamp, decimal, uuid, varchar, serial, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// USERS
// ============================================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  namaLengkap: varchar('nama_lengkap', { length: 100 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(), // role utama
  rolesTambahan: text('roles_tambahan').array().notNull().default([]), // ditetapkan Direktur Utama (migrasi 008)
  email: varchar('email', { length: 100 }),
  passwordHash: text('password_hash').notNull(),
  foto: text('foto'), // data URL 256px (migrasi 013)
  pinResetHash: text('pin_reset_hash'), // PIN Reset Total Superuser, scrypt (migrasi 014); jangan pernah dikirim ke browser
  aktif: boolean('aktif').notNull().default(true),
  divisiAssigned: varchar('divisi_assigned', { length: 30 }).notNull().default('ALL'), // 'ALL' (Pimpinan) | 'MANUFAKTUR' | 'FNB' (Bawahan)
  cabang: varchar('cabang', { length: 50 }).notNull().default('Pusat'),
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
  hargaBeli: decimal('harga_beli', { precision: 15, scale: 2 }).default('0'), // Harga yang dibayar ke Supplier
  hargaBeliKarton: decimal('harga_beli_karton', { precision: 15, scale: 2 }).notNull().default('0'), // Harga beli 1 karton dari Supplier (beda dari harga pcs)
  hargaJual: decimal('harga_jual', { precision: 15, scale: 2 }).default('0'), // Harga jual kembali ke Customer
  supplier: varchar('supplier', { length: 150 }), // Pemasok / Asal Barang
  settingPcs: integer('setting_pcs').notNull().default(1),
  pakaiKarton: boolean('pakai_karton').notNull().default(true),
  stokMinimum: integer('stok_minimum').default(10),
  keterangan: text('keterangan'),
  divisi: varchar('divisi', { length: 30 }).notNull().default('MANUFAKTUR'), // MANUFAKTUR | FNB
  cabang: varchar('cabang', { length: 50 }).notNull().default('Pusat'),
  tipeItem: varchar('tipe_item', { length: 30 }).notNull().default('barang_jadi'), // barang_jadi | bahan_baku | kemasan | menu_olahan
  hargaFranchise: decimal('harga_franchise', { precision: 15, scale: 2 }).notNull().default('0'), // harga Dapur Pusat ke franchise
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
  totalBeli: decimal('total_beli', { precision: 15, scale: 2 }).default('0'),
  supplier: varchar('supplier', { length: 150 }).notNull(), // Wajib ada supplier pemasok
  noFaktur: varchar('no_faktur', { length: 100 }),
  skemaBayar: varchar('skema_bayar', { length: 30 }).notNull().default('lunas'), // 'lunas' | 'hutang' | 'retur'
  jenis: varchar('jenis', { length: 30 }).notNull().default('PEMBELIAN'), // PEMBELIAN | RETUR_PELANGGAN
  jatuhTempo: timestamp('jatuh_tempo'),
  divisi: varchar('divisi', { length: 30 }).notNull().default('MANUFAKTUR'),
  cabang: varchar('cabang', { length: 50 }).notNull().default('Pusat'),
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
  divisi: varchar('divisi', { length: 30 }).notNull().default('MANUFAKTUR'),
  cabang: varchar('cabang', { length: 50 }).notNull().default('Pusat'),
  channel: varchar('channel', { length: 30 }).notNull().default('GROSIR'), // GROSIR | POS | INTERNAL
  keterangan: text('keterangan'),
  createdBy: varchar('created_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// FAKTUR PENJUALAN (header; baris barang = barang_keluar dengan trx_id = no_faktur)
// ============================================================
export const fakturPenjualan = pgTable('faktur_penjualan', {
  id: uuid('id').primaryKey().defaultRandom(),
  noFaktur: varchar('no_faktur', { length: 100 }).notNull().unique(),
  tanggal: timestamp('tanggal').notNull(),
  jatuhTempo: timestamp('jatuh_tempo'),
  pelanggan: varchar('pelanggan', { length: 150 }).notNull(),
  pelangganId: uuid('pelanggan_id').references(() => kontak.id, { onDelete: 'set null' }),
  telepon: varchar('telepon', { length: 30 }),
  alamat: text('alamat'),
  salesman: varchar('salesman', { length: 100 }),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).notNull().default('0'),
  diskonFaktur: decimal('diskon_faktur', { precision: 15, scale: 2 }).notNull().default('0'),
  ppnPersen: decimal('ppn_persen', { precision: 5, scale: 2 }).notNull().default('0'),
  ppn: decimal('ppn', { precision: 15, scale: 2 }).notNull().default('0'),
  ongkir: decimal('ongkir', { precision: 15, scale: 2 }).notNull().default('0'),
  grandTotal: decimal('grand_total', { precision: 15, scale: 2 }).notNull().default('0'),
  metodeBayar: varchar('metode_bayar', { length: 20 }).notNull().default('tunai'), // tunai | transfer | tempo
  dibayar: decimal('dibayar', { precision: 15, scale: 2 }).notNull().default('0'),
  sisaPiutang: decimal('sisa_piutang', { precision: 15, scale: 2 }).notNull().default('0'),
  status: varchar('status', { length: 20 }).notNull().default('lunas'), // lunas | sebagian | belum_lunas
  divisi: varchar('divisi', { length: 30 }).notNull().default('MANUFAKTUR'),
  cabang: varchar('cabang', { length: 50 }).notNull().default('Pusat'),
  catatan: text('catatan'),
  createdBy: varchar('created_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Riwayat piutang per faktur: pembayaran (cicilan/pelunasan) & mundur jatuh tempo.
// Tanpa FK ke faktur agar jejak audit tetap ada walau faktur dibatalkan.
export const piutangMutasi = pgTable('piutang_mutasi', {
  id: uuid('id').primaryKey().defaultRandom(),
  noFaktur: varchar('no_faktur', { length: 100 }).notNull(),
  jenis: varchar('jenis', { length: 20 }).notNull(), // bayar | ubah_tempo | retur | refund | batal_retur | batal_refund
  tanggal: timestamp('tanggal').notNull().defaultNow(),
  jumlah: decimal('jumlah', { precision: 15, scale: 2 }).notNull().default('0'),
  metode: varchar('metode', { length: 20 }), // tunai | transfer
  jatuhTempoLama: timestamp('jatuh_tempo_lama'),
  jatuhTempoBaru: timestamp('jatuh_tempo_baru'),
  sisaSetelah: decimal('sisa_setelah', { precision: 15, scale: 2 }).notNull().default('0'),
  catatan: text('catatan'),
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
  cabang: varchar('cabang', { length: 50 }).notNull().default('Pusat'), // cabang penerima barang
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
  noRetur: varchar('no_retur', { length: 30 }), // RTRNBBTTNNN (migrasi 011)
  tanggal: timestamp('tanggal').notNull(),
  sku: varchar('sku', { length: 50 }).notNull(),
  namaBarang: varchar('nama_barang', { length: 150 }).notNull(),
  qty: integer('qty').notNull(),
  alasan: text('alasan'),
  pelanggan: varchar('pelanggan', { length: 150 }),
  divisi: varchar('divisi', { length: 30 }).notNull().default('MANUFAKTUR'),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  cabang: varchar('cabang', { length: 50 }).notNull().default('Pusat'),
  // Retur pelanggan lewat Barang Masuk (migrasi 007). Baris lama: semua bawaan.
  noFaktur: varchar('no_faktur', { length: 100 }),
  kondisi: varchar('kondisi', { length: 20 }).notNull().default('layak'), // layak (masuk stok) | rusak (barang rusak)
  nilai: decimal('nilai', { precision: 15, scale: 2 }).notNull().default('0'),
  potongPiutang: decimal('potong_piutang', { precision: 15, scale: 2 }).notNull().default('0'),
  refund: decimal('refund', { precision: 15, scale: 2 }).notNull().default('0'),
  metodeRefund: varchar('metode_refund', { length: 20 }),
  barangMasukId: uuid('barang_masuk_id'),
  barangRusakId: uuid('barang_rusak_id'),
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
  divisi: varchar('divisi', { length: 30 }).notNull().default('MANUFAKTUR'),
  cabang: varchar('cabang', { length: 50 }).notNull().default('Pusat'),
  keterangan: text('keterangan'),
  createdBy: varchar('created_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// MUTASI BARANG
// ============================================================
export const mutasiBarang = pgTable('mutasi_barang', {
  id: uuid('id').primaryKey().defaultRandom(),
  noMutasi: varchar('no_mutasi', { length: 30 }), // MTSBBTTNNN (migrasi 011)
  tanggal: timestamp('tanggal').notNull(),
  sku: varchar('sku', { length: 50 }).notNull(),
  namaBarang: varchar('nama_barang', { length: 150 }).notNull(),
  qty: integer('qty').notNull(),
  dari: varchar('dari', { length: 100 }).notNull(),
  ke: varchar('ke', { length: 100 }).notNull(),
  divisi: varchar('divisi', { length: 30 }).notNull().default('MANUFAKTUR'),
  cabang: varchar('cabang', { length: 50 }).notNull().default('Pusat'),
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
  divisi: varchar('divisi', { length: 30 }).notNull().default('MANUFAKTUR'), // MANUFAKTUR | FNB | HOLDING
  cabang: varchar('cabang', { length: 50 }).notNull().default('Pusat'),
  keterangan: text('keterangan'),
  referensi: varchar('referensi', { length: 100 }), // no faktur asal kas (audit)
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
  divisi: varchar('divisi', { length: 30 }).notNull().default('MANUFAKTUR'), // MANUFAKTUR | FNB | HOLDING
  cabang: varchar('cabang', { length: 50 }).notNull().default('Pusat'),
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

// ============================================================
// RESEP / BILL OF MATERIALS (BOM) — F&B & Olahan Manufaktur
// ============================================================
export const resepItems = pgTable('resep_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  menuSku: varchar('menu_sku', { length: 50 }).notNull(),
  bahanSku: varchar('bahan_sku', { length: 50 }).notNull(),
  namaBahan: varchar('nama_bahan', { length: 150 }).notNull(),
  takaran: decimal('takaran', { precision: 10, scale: 2 }).notNull().default('1'),
  satuan: varchar('satuan', { length: 20 }).notNull().default('gram'),
  jenis: varchar('jenis', { length: 20 }).notNull().default('bahan'), // bahan | kemasan
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// CASH OPNAME — Rekonsiliasi Kasir Laci Harian
// ============================================================
export const cashOpname = pgTable('cash_opname', {
  id: uuid('id').primaryKey().defaultRandom(),
  tanggal: timestamp('tanggal').notNull().defaultNow(),
  shift: varchar('shift', { length: 50 }).notNull().default('Shift 1'),
  kasir: varchar('kasir', { length: 100 }).notNull(),
  kasAwal: decimal('kas_awal', { precision: 15, scale: 2 }).notNull().default('0'),
  omsetTunai: decimal('omset_tunai', { precision: 15, scale: 2 }).notNull().default('0'),
  kasKeluar: decimal('kas_keluar', { precision: 15, scale: 2 }).notNull().default('0'),
  kasSeharusnya: decimal('kas_seharusnya', { precision: 15, scale: 2 }).notNull().default('0'),
  kasFisik: decimal('kas_fisik', { precision: 15, scale: 2 }).notNull().default('0'),
  selisih: decimal('selisih', { precision: 15, scale: 2 }).notNull().default('0'),
  status: varchar('status', { length: 30 }).notNull().default('pas'), // pas | lebih | kurang
  catatan: text('catatan'),
  createdBy: varchar('created_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// HUTANG SUPPLIER (Accounts Payable)
// ============================================================
export const hutangSupplier = pgTable('hutang_supplier', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplier: varchar('supplier', { length: 150 }).notNull(),
  noFaktur: varchar('no_faktur', { length: 100 }),
  tanggal: timestamp('tanggal').notNull().defaultNow(),
  jatuhTempo: timestamp('jatuh_tempo'),
  totalHutang: decimal('total_hutang', { precision: 15, scale: 2 }).notNull().default('0'),
  sisaHutang: decimal('sisa_hutang', { precision: 15, scale: 2 }).notNull().default('0'),
  status: varchar('status', { length: 30 }).notNull().default('belum_lunas'), // belum_lunas | lunas
  divisi: varchar('divisi', { length: 30 }).notNull().default('MANUFAKTUR'), // MANUFAKTUR | FNB
  catatan: text('catatan'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================
// MASTER CABANG
// ============================================================
export const masterCabang = pgTable('master_cabang', {
  id: serial('id').primaryKey(),
  kodeCabang: varchar('kode_cabang', { length: 20 }).notNull().unique(),
  namaCabang: varchar('nama_cabang', { length: 100 }).notNull().unique(),
  divisi: varchar('divisi', { length: 30 }).notNull().default('ALL'),
  alamat: text('alamat'),
  telepon: varchar('telepon', { length: 50 }),
  isPusat: boolean('is_pusat').notNull().default(false),
  tipe: varchar('tipe', { length: 20 }).notNull().default('CABANG'), // PUSAT (Dapur Pusat) | CABANG | FRANCHISE
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================
// PENGATURAN PERUSAHAAN (1 baris, id = 1) — diatur Direktur Utama
// ============================================================
export const pengaturanPerusahaan = pgTable('pengaturan_perusahaan', {
  id: integer('id').primaryKey().default(1),
  wajibPin: boolean('wajib_pin').notNull().default(false), // false = semua aksi tanpa PIN supervisor
  maxDiskonTanpaPin: integer('max_diskon_tanpa_pin').notNull().default(15),
  pinVoidCart: boolean('pin_void_cart').notNull().default(true),
  pinHapusTransaksi: boolean('pin_hapus_transaksi').notNull().default(true),
  pinHash: text('pin_hash'), // scrypt; PIN asli tidak pernah disimpan
  updatedBy: varchar('updated_by', { length: 50 }),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================
// STOK PER CABANG — sumber stok tiap cabang.
// inventory.stok = jumlah stok semua cabang (dijaga oleh src/shared/lib/stock.ts).
// ============================================================
export const stokCabang = pgTable(
  'stok_cabang',
  {
    sku: varchar('sku', { length: 50 }).notNull(),
    cabang: varchar('cabang', { length: 50 }).notNull(),
    stok: integer('stok').notNull().default(0),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sku, t.cabang] })]
);

// ============================================================
// DAPUR PUSAT & FRANCHISE (docs/PRD-dapur-pusat-franchise.md)
// ============================================================

// Resep per batch: jumlah hasil; bahan di resep_items, biaya lain di resep_biaya.
export const resepHeader = pgTable('resep_header', {
  menuSku: varchar('menu_sku', { length: 50 }).primaryKey(),
  hasilQty: integer('hasil_qty').notNull().default(1),
  catatan: text('catatan'),
  updatedBy: varchar('updated_by', { length: 50 }),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const resepBiaya = pgTable('resep_biaya', {
  id: uuid('id').primaryKey().defaultRandom(),
  menuSku: varchar('menu_sku', { length: 50 }).notNull(),
  nama: varchar('nama', { length: 100 }).notNull(),
  jumlah: decimal('jumlah', { precision: 15, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const produksi = pgTable('produksi', {
  id: uuid('id').primaryKey().defaultRandom(),
  noProduksi: varchar('no_produksi', { length: 100 }).notNull().unique(),
  tanggal: timestamp('tanggal').notNull().defaultNow(),
  menuSku: varchar('menu_sku', { length: 50 }).notNull(),
  namaBarang: varchar('nama_barang', { length: 150 }).notNull(),
  jumlahBatch: integer('jumlah_batch').notNull(),
  hasilQty: integer('hasil_qty').notNull(),
  biayaBahan: decimal('biaya_bahan', { precision: 15, scale: 2 }).notNull().default('0'),
  biayaLain: decimal('biaya_lain', { precision: 15, scale: 2 }).notNull().default('0'),
  hppTotal: decimal('hpp_total', { precision: 15, scale: 2 }).notNull().default('0'),
  hppPerUnit: decimal('hpp_per_unit', { precision: 15, scale: 2 }).notNull().default('0'),
  cabang: varchar('cabang', { length: 50 }).notNull().default('Pusat'),
  catatan: text('catatan'),
  createdBy: varchar('created_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const produksiBahan = pgTable('produksi_bahan', {
  id: uuid('id').primaryKey().defaultRandom(),
  produksiId: uuid('produksi_id').notNull().references(() => produksi.id, { onDelete: 'cascade' }),
  bahanSku: varchar('bahan_sku', { length: 50 }).notNull(),
  namaBahan: varchar('nama_bahan', { length: 150 }).notNull(),
  qty: integer('qty').notNull(),
  harga: decimal('harga', { precision: 15, scale: 2 }).notNull().default('0'),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).notNull().default('0'),
});

export const orderFranchise = pgTable('order_franchise', {
  id: uuid('id').primaryKey().defaultRandom(),
  noOrder: varchar('no_order', { length: 100 }).notNull().unique(),
  tanggal: timestamp('tanggal').notNull().defaultNow(),
  franchise: varchar('franchise', { length: 50 }).notNull(), // nama cabang franchise
  status: varchar('status', { length: 20 }).notNull().default('diajukan'), // diajukan | dikirim | diterima | ditolak | dibatalkan
  total: decimal('total', { precision: 15, scale: 2 }).notNull().default('0'),
  noFaktur: varchar('no_faktur', { length: 100 }),
  catatan: text('catatan'),
  alasan: text('alasan'),
  createdBy: varchar('created_by', { length: 50 }),
  dikirimBy: varchar('dikirim_by', { length: 50 }),
  dikirimAt: timestamp('dikirim_at'),
  diterimaBy: varchar('diterima_by', { length: 50 }),
  diterimaAt: timestamp('diterima_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const orderFranchiseItems = pgTable('order_franchise_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orderFranchise.id, { onDelete: 'cascade' }),
  sku: varchar('sku', { length: 50 }).notNull(),
  namaBarang: varchar('nama_barang', { length: 150 }).notNull(),
  qty: integer('qty').notNull(),
  harga: decimal('harga', { precision: 15, scale: 2 }).notNull().default('0'),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).notNull().default('0'),
});
