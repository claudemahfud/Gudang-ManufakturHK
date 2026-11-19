# Panduan Pengembang (Developer Guide) — Gudang Manufaktur HK

Dokumen ini adalah pedoman utama bagi developer dan asisten AI yang bekerja di repositori ini.

---

## ⚠️ PENTING: ATURAN ANTI-DUPLIKASI FITUR (WAJIB DIBACA)

> [!CAUTION]
> **JANGAN MEMBUAT FITUR / HALAMAN / API DUPLIKAT!**
> 
> Sebelum mengusulkan, merancang, atau membuat fitur baru:
> 1. **Periksa Daftar Modul & Rute yang Sudah Ada** di bagian katalog bawah atau di [src/router/routes.ts](file:///d:/SourceCode/Gudang-ManufakturHK/src/router/routes.ts).
> 2. **Periksa Controller API yang Sudah Ada** di folder `src/app/api/**`.
> 3. **Periksa Skema Database yang Sudah Ada** di [src/shared/lib/db/schema.ts](file:///d:/SourceCode/Gudang-ManufakturHK/src/shared/lib/db/schema.ts).
> 
> **Jika fungsi atau kemampuannya sudah ada di dalam sistem:**
> * **DILARANG** membuat halaman, rute, atau tabel baru yang fungsinya tumpang-tindih (redundant).
> * **Kembangkan, perluas, atau integrasikan** modul yang sudah ada alih-alih membuat rute/komponen baru.

---

## 📦 Katalog Fitur & Modul yang Sudah Ada

Aplikasi ini sudah memiliki **25+ modul lengkap** yang siap pakai:

### 1. Modul Penjualan & Point of Sales (POS)
* **Kasir POS Standalone Fullscreen** (`/pos`):
  * Layar penuh mandiri terpisah dari BackOffice (tanpa sidebar).
  * Optimasi smartphone, tablet, dan desktop.
  * Fitur **Setting POS Terpisah** (modal konfigurasi toko, printer, audio beep, dan footer nota).
  * Cetak Nota Thermal **58mm** otomatis via `@media print`.
  * Multi-role: dapat digunakan oleh Direktur Utama, Manager, Admin, Gudang, Salesman, dan Agen.
* **Laporan Penjualan & Laba Bersih** (`/laporan-penjualan`):
  * Detail Omset Netto, HPP Modal Beli, Laba Kotor/Profit Bersih, Potongan Diskon, dan Margin Profit (%).
  * Filter rentang tanggal (Hari Ini, 7 Hari, Bulan Ini, Custom) & filter kasir/salesman.
* **Produk Detile Terjual** (`/produk-terjual`):
  * Rekapitulasi perputaran produk: Qty Terjual, Qty Terbuang/Rusak, dan Qty Retur Masuk.
  * Grafik transaksi 24 jam (**Peak Hour**) untuk deteksi jam-jam sibuk.
  * Filter per hari, **filter per jam transaksi** (misal: 08:00 - 12:00), dan filter brand.
* **Laporan Barang Rusak & Retur** (`/laporan-rusak-retur`):
  * Audit kerugian modal finansial (Rp) dari barang afkir/rusak berdasarkan HPP modal.
  * Tab Barang Rusak & Terbuang vs Tab Barang Retur Pelanggan.

### 2. Modul Utama & Gudang
* **Dashboard Utama** (`/dashboard`): Live monitor aset inventory, total master SKU, alert stok kritis, dan grafik stok brand.
* **Master Inventory** (`/inventory`): Master data SKU, nama barang, brand, gramasi, varian, harga beli, harga jual, setting karton/pcs, dan stok minimum.
* **Barang Masuk** (`/barang-masuk`): Penerimaan stok supplier & nomor faktur.
* **Barang Keluar** (`/barang-keluar`): Pengiriman/penjualan grosir & cetak invoice.
* **Mutasi Barang** (`/mutasi-barang`): Pemindahan stok antar rak/gudang.
* **Stok Kritis** (`/stok-kritis`): Peringatan dini barang yang mendekati limit minimum.
* *(Catatan: Fitur Barang Rusak lama `/barang-rusak` telah digabungkan satu pintu ke `/laporan-rusak-retur` agar tidak duplikat).*

### 3. Modul Harmonisasi F&B & Manufaktur (Satu Plafon)
* **Kalkulator HPP & Resep / BOM** (`/kalkulator-hpp`): Menghubungkan menu F&B / olahan manufaktur dengan bahan baku dapur & kemasan (gram/ml/pcs). Menghitung HPP otomatis, susut waste %, utilitas %, dan rekomendasi harga jual.
* **Cash Opname Laci Kasir** (`/cash-opname`): Rekonsiliasi harian kas fisik di laci kasir POS vs perhitungan sistem untuk mendeteksi selisih lebih/kurang kasir.
* **Neraca Saldo Posisi Keuangan** (`/neraca`): Posisi aset lancar (kas, bank, persediaan gudang), kewajiban hutang supplier, dan ekuitas konsolidasi satu plafon.

### 3. Modul Dokumen & Logistik
* **Surat Jalan** (`/surat-jalan`): Pembuatan surat jalan pengiriman, ekspedisi, armada, dan item delivery.
* **PO Loading** (`/po-loading`): Perintah muat barang ke armada truk/mobil.
* **Retur Barang** (`/retur-barang`): Manajemen klaim retur barang dari pelanggan.

### 4. Modul Keuangan & Biaya
* **Keuangan** (`/keuangan`): Buku kas arus uang masuk & keluar.
* **Biaya Operasional** (`/biaya-operasional`): Pencatatan pengeluaran operasional (BBM, servis, logistik, dll.).

### 5. Modul Salesman & Agen
* **Pengajuan Diskon** (`/pengajuan-diskon`): Sales mengajukan diskon khusus pelanggan; Manajemen meng-approve/reject.
* **Monitor Salesman** (`/monitor-salesman`): Kinerja dan omset per salesman.
* **Target Komisi** (`/target-komisi`): Target omset dan komisi periodik salesman.

### 6. Modul Operasional & Administrasi
* **Expedisi / Armada** (`/expedisi`): Manajemen armada mobil/truk dan status servis.
* **Kontak Mitra** (`/kontak`): Buku alamat pelanggan dan supplier.
* **Pengguna** (`/users`): Manajemen akun user dan penugasan role (Admin only).
* **Log Aktivitas** (`/logs`): Audit trail jejak aksi pengguna di seluruh sistem.
* **Autentikasi & Reset Password** (`/login`, `/forgot-password`, OTP verification).
* **Floating AssistiveTouch Button**: Tombol mengambang elegan di kanan bawah dashboard untuk shortcut instan ke POS kasir.

---

## 🏛️ Konvensi Arsitektur & Struktur Proyek

1. **Routing App Router**:
   * Rute terpusat pada file [src/router/routes.ts](file:///d:/SourceCode/Gudang-ManufakturHK/src/router/routes.ts).
   * **1 Rute = 1 Folder Mandiri** di `src/views/{slug}/`:
     * Komponen halaman: `src/views/{slug}/{NamaKomponen}.tsx`
     * Barrel export: `src/views/{slug}/index.ts`
     * App Router wrapper: `src/app/(dashboard)/{slug}/page.tsx` (atau `src/app/{slug}/page.tsx` untuk standalone).
2. **Database & ORM**:
   * PostgreSQL via Supabase Connection Pooler (`DATABASE_URL`).
   * Schema Drizzle ORM terpusat di [src/shared/lib/db/schema.ts](file:///d:/SourceCode/Gudang-ManufakturHK/src/shared/lib/db/schema.ts).
   * Seluruh tabel di Supabase telah memiliki **Row Level Security (RLS) ENABLED**.
3. **Keamanan & Otorisasi (RBAC)**:
   * NextAuth v5 dengan proteksi Edge Middleware di [src/middleware.ts](file:///d:/SourceCode/Gudang-ManufakturHK/src/middleware.ts).
   * Server helper `requireAuthRole()` di [src/shared/lib/auth/rbac.ts](file:///d:/SourceCode/Gudang-ManufakturHK/src/shared/lib/auth/rbac.ts).
4. **Standar Desain UI/UX**:
   * Desain minimalis modern profesional (palet Slate/Neutral, aksen Emerald).
   * **Bebas Emoji**: Dilarang menggunakan emoji pada tampilan UI; gunakan icon monochrome vector dari `lucide-react`.
   * Favicon monochrome SVG di [public/favicon.svg](file:///d:/SourceCode/Gudang-ManufakturHK/public/favicon.svg).
