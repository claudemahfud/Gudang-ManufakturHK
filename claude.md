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
  * Fitur **Setting POS Terpisah** (modal konfigurasi toko, printer, audio beep, footer nota, dan **Proteksi Anti-Fraud PIN Supervisor**).
  * **Proteksi PIN Supervisor (Anti-Fraud)** — opsional, diatur **Direktur Utama** di **Pengaturan Perusahaan** (`/pengaturan-perusahaan`, tabel `pengaturan_perusahaan`, API `/api/pengaturan`):
    * Direktur memilih wajib PIN atau tanpa PIN. Default: tanpa PIN.
    * Bila wajib: diskon di atas batas (default 15%), kosongkan keranjang (*Void Cart*), dan hapus transaksi barang keluar dapat diwajibkan PIN.
    * PIN disimpan ter-hash (scrypt) dan **diverifikasi di server** (`/api/pos/checkout`, `/api/barang-keluar/[id]`, `/api/pengaturan/verifikasi-pin`), maks 5 PIN salah / pengguna / 15 menit. Tidak ada lagi PIN di localStorage.
    * Dilengkapi On-Screen Numeric Keypad touch-friendly untuk mesin kasir touchscreen.
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
* **Barang Keluar** (`/barang-keluar`): Pengiriman/penjualan grosir & cetak invoice. Dilengkapi proteksi **PIN Supervisor Anti-Fraud** saat menghapus data riwayat transaksi penjualan/pengeluaran untuk melindungi integritas laporan omset tunai.
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
* **Pengguna** (`/users`): Manajemen akun user dan penugasan role (Admin only). Dilengkapi **Kartu Data Pengguna Collapsible / Minimized**: secara default kartu tertutup ciut (*collapsed*) guna menghemat ruang layar dan memuat cepat, serta dapat dibuka/diciutkan kembali melalui tombol *Buka Data User / Ciutkan (Minimize)*.
* **Ergonomi Interaksi Navigasi & Dokumen**: Seluruh kartu menu (Creative Mega Menu, Dashboard Quick Hub) dan tabel dokumen (`/surat-jalan`, `/po-loading`, `/barang-keluar`) dapat dibuka langsung dengan mengklik nama kartu atau nomor dokumen/pelanggan, tanpa keharusan mengklik tombol aksi kecil.
* **Setting Profil Akun & Ganti Mode** (`/profile`):
  * Pengaturan data diri pengguna (Nama Lengkap, Email, Username, Role, Cabang).
  * Pembaruan kata sandi akun aman dengan verifikasi password lama.
  * **Pusat Ganti Mode Operasional**: Menampung pemilihan domain (Manufaktur vs F&B) dengan aturan wajib logout terlebih dahulu untuk menjaga isolasi data.
  * Trigger cepat melalui dropdown avatar/nama akun di pojok kanan atas Header.
* **Log Aktivitas** (`/logs`): Audit trail jejak aksi pengguna di seluruh sistem.
* **Autentikasi & Reset Password** (`/login`, `/forgot-password`, OTP verification).
* **Floating AssistiveTouch Button**: Tombol mengambang elegan di kanan bawah dashboard untuk shortcut instan ke POS kasir.
* **Creative Mega Menu (`Header.tsx` / `CreativeMegaMenu.tsx`)**: Navigasi multi-kolom expanded di Header atas untuk akses kilat seluruh modul dalam 1-2 klik.

---

## 📐 Standar Desain Layout, Tipografi & Aksesibilitas (WCAG Compliant)

### 1. Struktur Layout Semantik (HTML5)
* Dilarang menggunakan generic `div` soup tanpa struktur. Gunakan tag semantik standar:
  * `<header>`: Topbar branding, title halaman, breadcrumb, atau header modal.
  * `<nav>`: Navigasi menu utama, tab switcher filter, mega menu dropdown.
  * `<main>`: Container konten utama halaman.
  * `<section>`: Kelompok blok konten terkait (misal: filter bar, data grid, form container).
  * `<article>`: Komponen independen yang dapat berdiri sendiri (kartu metrik KPI, kartu katalog produk POS, baris kartu aksi).
  * `<aside>`: Sidebar navigasi desktop/mobile, filter panel samping, atau drawer keranjang belanja POS.
  * `<footer>`: Informasi copyright, rangkuman hitungan tabel, audit trail, atau versi sistem.

### 2. Pedoman Tipografi Anti-Desak-Desakan (Title, Sub-Title, Sub-Sub-Title)
Teks tidak boleh bertumpuk padat tanpa napas (*kruntelan*). Setiap teks wajib mengikuti salah satu dari 5 pola penulisan:

1. **Single Line**:
   * Digunakan untuk: Chip badge, status transaksi, metric satu angka, action button label.
   * Format: `text-xs font-semibold text-slate-700 truncate`.
2. **Dual Line**:
   * Digunakan untuk: Header form sederhana, profil user ringkas, list item standar.
   * Line 1 (Title): `text-sm font-bold text-slate-900 leading-tight`.
   * Line 2 (Sub-title): `text-xs text-slate-600 mt-0.5 leading-normal`.
3. **Triple Line**:
   * Digunakan untuk: Header halaman utama, hero banner, card spotlight unggulan.
   * Line 1 (Overline / Eyebrow): `text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded`.
   * Line 2 (Title): `text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight leading-tight mt-1`.
   * Line 3 (Sub-title): `text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed max-w-2xl`.
4. **List Dual-Line**:
   * Digunakan untuk: Baris tabel data, menu list navigasi, dropdown option.
   * Top Line: `text-xs sm:text-sm font-bold text-slate-900 leading-tight`.
   * Bottom Line: `text-[11px] text-slate-600 font-medium leading-normal mt-0.5`.
5. **List Triple-Line**:
   * Digunakan untuk: Item keranjang POS, card barang kritis, audit log row.
   * Line 1 (Context): `text-[10px] font-semibold text-slate-500 uppercase tracking-wider`.
   * Line 2 (Entity): `text-xs sm:text-sm font-bold text-slate-900 leading-tight`.
   * Line 3 (Specs / Values): `text-[11px] text-slate-600 font-mono mt-0.5 flex items-center gap-2`.

### 3. Pedoman Aksesibilitas WCAG (Level AA Compliant)
* **Contrast Ratio**: Minimal rasio 4.5:1 untuk teks normal dan 3:1 untuk teks tebal/besar.
  * Teks utama: `text-slate-950` / `text-slate-900` (kontras 14:1+).
  * Teks sekunder/sub-title: `text-slate-600` / `text-slate-700` (kontras 7:1+). Dilarang memakai `text-gray-400` untuk teks deskripsi penting.
  * Background gelap (dark mode / header POS): teks utama `text-white`, teks sekunder `text-slate-200` / `text-slate-300`.
* **Line Height**: Gunakan `leading-tight` pada heading/title dan `leading-normal` atau `leading-relaxed` pada body copy untuk memastikan kenyamanan mata saat membaca (*breathing space*).
* **Keyboard & Screen Reader**: Berikan atribut `aria-label`, `aria-labelledby`, dan support tombol `Esc` untuk menutup popup/drawer/mega menu.

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

---

## 🛡️ Standar Integritas Data & Proteksi Sistem (Audit Results & Rules)

Berdasarkan audit komprehensif sistem (20 November 2026), seluruh modul dan API mematuhi standar berikut:

1. **Proteksi Input Ganda (Anti Double-Submit Guard)**:
   * Seluruh formulir di views (`src/views/**/*.tsx`) dan proses kasir POS wajib memiliki guard `if (submitting) return;` / `if (isSubmitting) return;` di awal handler pengiriman data. Hal ini mencegah duplikasi pencatatan database akibat double-click pengguna.
2. **Otorisasi Ketat Operasi Destruktif (RBAC pada DELETE / PUT)**:
   * Seluruh endpoint `DELETE` pada API wajib menggunakan `requireAuthRole(...)` dari `src/shared/lib/auth/rbac.ts` dan mencatat `aksi` ke dalam tabel `logs` untuk pertanggungjawaban audit trail:
     * Keuangan, Biaya Operasional, Target Komisi, Kontak: `ROLES_FINANCE` / `ROLES_EXECUTIVE`.
     * Master Inventory, Barang Keluar: `ROLES_EXECUTIVE`.
     * Barang Masuk, Barang Rusak, Mutasi Barang, Retur, PO Loading: `ROLES_WAREHOUSE`.
     * Surat Jalan, Armada: `ROLES_EXPEDISI`.
3. **Pencegahan Stok Negatif & Validasi Stok Kritis**:
   * Setiap API pengeluaran barang (`/api/barang-keluar`), mutasi (`/api/mutasi-barang`), dan pencatatan rusak (`/api/barang-rusak`) wajib memverifikasi ketersediaan stok fisik di `inventory` (`inv.stok >= requestedQty`) sebelum eksekusi pemotongan dilakukan.
4. **Auto-Sinkronisasi Master SKU**:
   * Penerimaan barang masuk (`/api/barang-masuk`) otomatis membuat entri master `inventory` baru jika SKU belum terdaftar, mencegah hilangnya pelacakan stok masuk.
5. **Integritas Relasi Foreign Key (Cascade Deletion)**:
   * Penghapusan dokumen multi-item (seperti Surat Jalan & PO Loading) wajib menghapus baris item anak (`suratJalanItems` / `poLoadingItems`) terlebih dahulu sebelum menghapus dokumen induk untuk mencegah kegagalan relasi foreign key pada database PostgreSQL.
6. **Anti-Duplikasi Kode & Modul**:
   * Seluruh rute `/barang-rusak` otomatis dialihkan ke `/laporan-rusak-retur` (modul terpadu laporan rusak & retur). Komponen lama yang usang dipelihara sebagai lightweight redirect.
7. **Jaminan Transaksi Atomik (ACID `db.transaction`)**:
   * Seluruh mutasi multi-tabel atau proses yang melibatkan pengurangan stok bersamaan dengan pencatatan jurnal (seperti Kasir POS `/api/pos/checkout`, pengeluaran multi-item `/api/barang-keluar`, penerbitan Surat Jalan `/api/surat-jalan`, PO Loading `/api/po-loading`, dan rollback stok pada pembatalan barang) dibungkus dalam `await db.transaction(async (tx) => { ... })` sehingga jika salah satu query gagal, seluruh operasi di-rollback secara otomatis tanpa meninggalkan inkonsistensi data.
8. **Validasi Finansial & Input Numerik Positif**:
   * Seluruh input uang pada arus kas (`/api/keuangan`), biaya operasional (`/api/biaya-operasional`), dan kas opname (`/api/fnb/cash-opname`) divalidasi `Number(val) > 0` (non-negatif dan non-NaN) di tingkat server sebelum dicatat ke ledger.
9. **Ekspor Data Universal (Excel / CSV dengan UTF-8 BOM)**:
   * Fitur ekspor di [src/shared/lib/export.ts](file:///d:/SourceCode/Gudang-ManufakturHK/src/shared/lib/export.ts) menggunakan standar RFC 4180 dan prepend prefix `\uFEFF` (Byte Order Mark) agar format angka, tanggal Indonesia, dan karakter khusus langsung dikenali otomatis oleh Microsoft Excel, LibreOffice, dan Google Sheets tanpa encoding yang rusak.
10. **Integrasi Barcode Scanner Ganda (Hardware & Kamera)**:
    * Dukungan perangkat barcode scanner hardware (USB / Bluetooth HID) melalui hook [src/shared/hooks/useBarcodeScanner.ts](file:///d:/SourceCode/Gudang-ManufakturHK/src/shared/hooks/useBarcodeScanner.ts) yang mendeteksi keystroke burst cepat (< 50ms per key) berakhiran Enter.
    * Dukungan kamera smartphone/tablet melalui komponen [src/shared/components/ui/CameraBarcodeScanner.tsx](file:///d:/SourceCode/Gudang-ManufakturHK/src/shared/components/ui/CameraBarcodeScanner.tsx) memanfaatkan native browser `BarcodeDetector` API tanpa dependensi library eksternal, dilengkapi animasi reticle laser, saklar senter (torch), dan respon audio-haptic.
11. **PWA & Ketahanan Offline Kasir (Offline Resilience)**:
    * Web App Manifest terdaftar di [public/manifest.json](file:///d:/SourceCode/Gudang-ManufakturHK/public/manifest.json) untuk kemampuan "Add to Home Screen" standalone pada layar tablet/smartphone kasir.
    * Keranjang belanja kasir POS otomatis dicadangkan ke `localStorage` (`pos_active_cart`) dan dipulihkan kembali saat browser dimuat ulang, mencegah hilangnya antrean belanjaan jika terjadi gangguan jaringan atau ketidaksengajaan reload.



