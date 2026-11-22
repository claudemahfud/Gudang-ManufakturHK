# 🏭 Gudang Manufaktur HK

> Sistem Manajemen Pergudangan & Distribusi Manufaktur Modern  
> Dibangun dengan **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS**, dan **PostgreSQL (Supabase)** dengan **Drizzle ORM**.

---

## 🚀 Fitur & Modul Sistem

Sistem ini merekonstruksi seluruh fungsionalitas sistem pergudangan lama (Firebase/Vanilla JS) ke dalam arsitektur modern yang skalabel dan type-safe:

1. **Dashboard Eksekutif (`/dashboard`)**: Ringkasan omzet, nilai inventory, stok kritis, dan grafik stok per brand.
2. **Master Inventory (`/inventory`)**: Master produk lengkap (SKU, brand, gramasi, varian, harga beli/jual, setting karton/pcs, filter debounce & pagination).
3. **Barang Masuk (`/barang-masuk`)**: Penerimaan kiriman stok supplier (otomatis menambah stok inventory & audit trail). Daftar **PO Dalam Proses**: tombol "Barang Datang" mengubah PO menjadi Faktur Pembelian yang bisa direvisi sesuai barang yang benar-benar datang; submit = stok masuk, lalu ditanya apakah ada barang cacat/rusak (Ya = formulir Return).
4. **Barang Keluar & Faktur Penjualan (`/barang-keluar`)**: Faktur penjualan grosir multi-item: pelanggan dari daftar kontak, diskon per barang & faktur, PPN, ongkos kirim, metode bayar (tunai/transfer/tempo) dengan uang muka & sisa piutang. Otomatis memotong stok, mencatat kas masuk, dan cetak faktur.
5. **Barang Rusak / Kadaluarsa (`/barang-rusak`)**: Pencatatan barang cacat/rusak dengan pemotongan stok otomatis.
6. **Mutasi Barang (`/mutasi-barang`)**: Perpindahan stok antar cabang (stok per cabang di tabel `stok_cabang`).
7. **Monitor Stok Kritis (`/stok-kritis`)**: Peringatan dini otomatis untuk barang dengan stok di bawah batas minimum (Restock quick-action).
8. **Surat Jalan (`/surat-jalan`)**: Dokumen legal pengiriman logistik, data armada/nopol, dan template cetak serah terima barang.
9. **PO Loading (`/po-loading`)**: Purchase order ke suplier/pabrik: isi formulir, unduh PDF/PNG, kirim manual (email/WhatsApp). PO tidak mengubah stok; penerimaan barang lewat Barang Masuk > Barang Datang.
10. **Retur Barang (`/retur-barang`)**: Pencatatan pengembalian barang dari pelanggan/toko beserta persetujuan masuk kembali ke stok.
11. **Arus Kas & Keuangan (`/keuangan`)**: Pencatatan kas masuk & kas keluar dengan rekap saldo berjalan.
12. **Biaya Operasional (`/biaya-operasional`)**: Pengeluaran rutin operasional (BBM, tol ekspedisi, servis armada, dll).
13. **Pengajuan Diskon Khusus (`/pengajuan-diskon`)**: Pengajuan potongan harga dari salesman ke pimpinan dengan workflow persetujuan (Approve/Reject).
14. **Monitor Salesman (`/monitor-salesman`)**: Papan peringkat salesman, transaksi riil, dan performa omzet penjualan.
15. **Target & Komisi (`/target-komisi`)**: Penetapan target bulanan sales dan kalkulasi otomatis komisi penjualan.
16. **Expedisi & Armada (`/expedisi`)**: Manajemen kendaraan angkut barang beserta status operasional (Aktif/Servis).
17. **Direktori Kontak (`/kontak`)**: Buku telepon pelanggan, toko grosir, dan supplier pabrik.
18. **Manajemen Pengguna (`/users`)**: Manajemen akun staf dengan 19 tingkatan hak akses role (Administrator, Direktur, Manager Umum, Finance & Accounting, Kepala Gudang, Salesman, Sales Canvas, Sales Motoris, Sales Agent, dll).
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

## 🔐 Akun Seed & Keamanan

Seed membuat akun `admin`, `direktur`, `kepalagudang`, dan `sales1` dengan password awal yang tertulis di `supabase/seed.sql`.
**Wajib ganti password semua akun seed segera setelah instalasi**, terutama di lingkungan produksi.

- Password di-hash dengan **scrypt + salt**. Hash SHA-256 lama tetap bisa login dan otomatis di-hash ulang ke scrypt saat login berhasil.
- `AUTH_SECRET` (atau `NEXTAUTH_SECRET`) **wajib** di-set; aplikasi tidak lagi memakai secret cadangan.
- Reset password via OTP membutuhkan `RESEND_API_KEY` dan `EMAIL_FROM`. Tanpa keduanya, kode OTP hanya tampil di konsol saat development dan tidak dikirim di produksi.
- Skrip di `scripts/` membaca koneksi dari `DATABASE_URL`: `node --env-file=.env.local scripts/<nama>.mjs`.
