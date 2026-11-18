# 🏭 Gudang Manufaktur HK

> Sistem Manajemen Pergudangan & Distribusi Manufaktur Modern  
> Dibangun dengan **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS**, dan **PostgreSQL (Supabase)** dengan **Drizzle ORM**.

---

## 🚀 Fitur & Modul Sistem

Sistem ini merekonstruksi seluruh fungsionalitas sistem pergudangan lama (Firebase/Vanilla JS) ke dalam arsitektur modern yang skalabel dan type-safe:

1. **Dashboard Eksekutif (`/dashboard`)**: Ringkasan omzet, nilai inventory, stok kritis, dan grafik stok per brand.
2. **Master Inventory (`/inventory`)**: Master produk lengkap (SKU, brand, gramasi, varian, harga beli/jual, setting karton/pcs, filter debounce & pagination).
3. **Barang Masuk (`/barang-masuk`)**: Penerimaan kiriman stok supplier (otomatis menambah stok inventory & audit trail).
4. **Barang Keluar & Loading (`/barang-keluar`)**: Surat loading muatan penjualan multi-item (otomatis memotong stok & cetak invoice/faktur).
5. **Barang Rusak / Kadaluarsa (`/barang-rusak`)**: Pencatatan barang cacat/rusak dengan pemotongan stok otomatis.
6. **Mutasi Barang (`/mutasi-barang`)**: Pencatatan perpindahan stok antar lokasi gudang/rak.
7. **Monitor Stok Kritis (`/stok-kritis`)**: Peringatan dini otomatis untuk barang dengan stok di bawah batas minimum (Restock quick-action).
8. **Surat Jalan (`/surat-jalan`)**: Dokumen legal pengiriman logistik, data armada/nopol, dan template cetak serah terima barang.
9. **PO Loading (`/po-loading`)**: Purchase order ke pabrik produsen dan fitur 1-klik "Terima Barang & Tambah Stok".
10. **Retur Barang (`/retur-barang`)**: Pencatatan pengembalian barang dari pelanggan/toko beserta persetujuan masuk kembali ke stok.
11. **Arus Kas & Keuangan (`/keuangan`)**: Pencatatan kas masuk & kas keluar dengan rekap saldo berjalan.
12. **Biaya Operasional (`/biaya-operasional`)**: Pengeluaran rutin operasional (BBM, tol ekspedisi, servis armada, dll).
13. **Pengajuan Diskon Khusus (`/pengajuan-diskon`)**: Pengajuan potongan harga dari salesman ke pimpinan dengan workflow persetujuan (Approve/Reject).
14. **Monitor Salesman (`/monitor-salesman`)**: Papan peringkat salesman, transaksi riil, dan performa omzet penjualan.
15. **Target & Komisi (`/target-komisi`)**: Penetapan target bulanan sales dan kalkulasi otomatis komisi penjualan.
16. **Expedisi & Armada (`/expedisi`)**: Manajemen kendaraan angkut barang beserta status operasional (Aktif/Servis).
17. **Direktori Kontak (`/kontak`)**: Buku telepon pelanggan, toko grosir, dan supplier pabrik.
18. **Manajemen Pengguna (`/users`)**: Manajemen akun staf dengan 14 tingkatan hak akses role (Administrator, Direktur, Kepala Gudang, Salesman, dll).
19. **Audit Trail Logs (`/logs`)**: Rekaman jejak audit seluruh aktivitas sistem gudang secara kronologis.
20. **Public Stock API (`/api/public/stock`)**: Endpoint publik tanpa auth untuk pengecekan stok live dari aplikasi eksternal/salesman.

---

## 🛠️ Stack Teknologi

- **Framework**: Next.js 16.4.6 (App Router + Turbopack)
- **UI / Styling**: React 19 + Tailwind CSS 4 + Poppins Font
- **Database**: PostgreSQL (Supabase Pooler)
- **ORM**: Drizzle ORM
- **Authentication**: NextAuth.js v5 (Credentials with SHA-256 + Edge-compatible Proxy Guard)
- **Visualisasi**: Recharts (Grafik Interaktif)

---

## 💻 Cara Menjalankan Secara Lokal

### 1. Salin Environment
Salin berkas `.env.example` ke `.env.local`:
```bash
cp .env.example .env.local
```

Isi variabel kredensial Supabase dan URL database Anda.

### 2. Inisialisasi Database
Jalankan migrasi skema tabel dan data awal ke PostgreSQL Supabase:
```bash
node --env-file=.env.local scripts/db-init.mjs
```

### 3. Jalankan Development Server
```bash
npm run dev
```
Buka browser di [http://localhost:3000](http://localhost:3000).

---

## 🔐 Akun Default Awal

| Username | Password | Role |
| :--- | :--- | :--- |
| `admin` | `admin123` | Administrator (Akses Penuh) |
| `direktur` | `admin123` | Direktur Utama |
| `kepalagudang` | `admin123` | Kepala Gudang |
| `sales1` | `admin123` | Salesman |
