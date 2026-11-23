# PRD — Dapur Pusat & Jaringan Franchise (F&B)

Status: Disetujui untuk dibangun · Tanggal: 23 November 2026 · Divisi: Food & Beverages

## 1. Latar Belakang

Divisi F&B saat ini sudah punya:

| Kemampuan | Modul yang ada | Batasan sekarang |
|---|---|---|
| Cabang | `master_cabang`, `/cabang` | Tidak membedakan Dapur Pusat, cabang milik sendiri, dan franchise |
| Stok per cabang | `stok_cabang`, `src/shared/lib/stock.ts` | Sudah terisolasi per cabang |
| Kasir POS per cabang | `/pos`, `/api/pos/checkout` | Karyawan cabang terkunci ke cabangnya |
| Resep / BOM | `resep_items`, `/kalkulator-hpp` | Biaya lain dihitung persentase tetap (3%, 5%, 7%), tanpa jumlah hasil per batch, tanpa harga jual ke franchise |
| Penjualan kredit | `faktur_penjualan`, `/piutang` | Belum dipakai untuk penjualan ke franchise |
| Pindah stok antar cabang | `mutasi_barang` | Tanpa tagihan, jadi tidak cocok untuk penjualan ke franchise |

Belum ada: produksi di dapur yang memotong bahan baku dan menambah produk jadi, alur order dari franchise ke Dapur Pusat, dan pantauan penjualan seluruh franchise di satu layar.

## 2. Tujuan

Satu manajemen pusat mengelola:

1. **Dapur Pusat** memasak dari **Master Resep** (bahan baku dan biaya lain per batch), dengan **HPP rinci** per produk.
2. **Franchise** membeli produk jadi dari Dapur Pusat. Pembelian ini menjadi tagihan (piutang) Dapur Pusat ke franchise.
3. **Setiap franchise punya aplikasinya sendiri.** Akun franchise terkunci ke outletnya dan punya gudang stok sendiri serta kasir POS sendiri.
4. **Manajemen melihat penjualan semua franchise** dari Dapur Pusat.

### Di luar lingkup (versi ini)

- Royalti atau fee franchise berkala.
- Deployment aplikasi terpisah per franchise. Franchise memakai aplikasi yang sama, dengan data yang dikunci per outlet lewat akunnya (lihat bagian 4).
- Harga jual POS berbeda per franchise. Harga jual konsumen tetap satu, dari master barang.
- Retur produk dari franchise ke Dapur Pusat. Untuk sementara pakai modul Retur yang sudah ada.

## 3. Pengguna & Peran

| Peran | Siapa | Akses |
|---|---|---|
| Manajemen Pusat | Administrator, Direktur Utama, Manager, Manager Umum | Semua: resep, HPP, produksi, order semua franchise, monitor franchise |
| Finance & Accounting | Finance | Monitor franchise, tagihan franchise lewat menu Piutang |
| Tim Dapur Pusat | Kepala Gudang di cabang Pusat | Resep, produksi, kirim order |
| Tim Franchise | Akun dengan `cabang` = nama outlet franchise (mis. Kepala Gudang, Staff Gudang, Salesman/kasir) | Hanya data outletnya: stok, POS, buat order, terima barang, lihat tagihan |

Tidak ada peran baru. Penguncian ke outlet memakai aturan isolasi cabang yang sudah ada: karyawan yang `cabang`-nya bukan `Pusat` hanya bisa melihat cabangnya sendiri.

## 4. Konsep Data

- **Dapur Pusat** = cabang `Pusat` (`is_pusat = true`). Semua produksi dan stok produk jadi siap kirim ada di sini.
- **Franchise** = baris `master_cabang` dengan kolom baru `tipe = 'FRANCHISE'`. Tipe lain: `PUSAT` dan `CABANG` (outlet milik sendiri).
- **"Aplikasi sendiri" per franchise** = login dengan akun yang terkunci ke outlet. Menu, stok, POS, dan laporan otomatis tersaring ke outlet itu.
- **Satuan stok bahan baku** = satuan terkecil (gram, ml, atau pcs), karena stok disimpan sebagai bilangan bulat. Takaran resep memakai satuan yang sama. Pemakaian bahan saat produksi dibulatkan ke atas.

## 5. Kebutuhan Fungsional

### F1. Master Resep & HPP (memperluas `/kalkulator-hpp`, bukan halaman baru)

- Pilih produk jadi F&B. Isi:
  - **Hasil per batch** (berapa unit produk dari satu kali masak).
  - **Bahan baku dan kemasan** per batch (SKU, takaran).
  - **Biaya lain-lain** per batch dalam rupiah (tenaga kerja, gas, listrik, sewa dapur, dan lain-lain; bebas ditambah).
  - **Harga jual ke franchise** per unit (kolom baru `inventory.harga_franchise`) dan harga jual konsumen (POS).
- HPP dihitung server:
  - `biaya bahan = Σ (takaran × harga beli bahan)`
  - `HPP per batch = biaya bahan + Σ biaya lain`
  - `HPP per unit = HPP per batch ÷ hasil per batch`
- Ditampilkan per produk:
  - Rincian per bahan dan per biaya.
  - Margin Dapur Pusat: harga franchise − HPP.
  - Margin franchise: harga jual konsumen − harga franchise.
  - Food cost %.
- Persentase tetap (susut 3%, utilitas 5%, tenaga kerja 7%) dihapus dan diganti biaya lain-lain yang diisi sendiri.

### F2. Produksi Dapur Pusat (baru: `/produksi-dapur`)

- Pilih produk yang sudah punya resep dan isi jumlah batch. Sebelum disimpan, tampil pratinjau pemakaian bahan dan HPP.
- Saat disimpan, dalam satu transaksi:
  1. Stok setiap bahan di Pusat berkurang. Kalau stok kurang, produksi ditolak dan tidak ada yang berubah.
  2. Stok produk jadi di Pusat bertambah sebanyak `hasil per batch × batch`.
  3. HPP produksi (biaya bahan, biaya lain, HPP per unit) tersimpan sebagai jejak.
  4. Harga beli produk jadi (`inventory.harga_beli`) diperbarui dengan rata-rata tertimbang (stok lama × harga lama + hasil × HPP), sama seperti Barang Masuk. Nilai ini dipakai laporan laba dan neraca.
  5. Aksi dicatat ke log.
- Riwayat produksi bisa dilihat. Produksi tidak bisa dihapus (jejak HPP); koreksi lewat stok opname.

### F3. Order Franchise (baru: `/order-franchise`)

Status order: `diajukan` → `dikirim` → `diterima`, atau berhenti di `ditolak` / `dibatalkan`.

| Langkah | Pelaku | Efek |
|---|---|---|
| Buat order | Franchise | Pilih produk dari katalog Dapur Pusat (produk F&B dengan harga franchise > 0, plus stok Pusat). Status `diajukan`. |
| Batalkan | Franchise | Hanya saat masih `diajukan`. |
| Tolak | Dapur Pusat | Hanya saat `diajukan`. Alasan wajib. |
| Kirim | Dapur Pusat | Terbit **Faktur Penjualan tempo** ke franchise: stok Pusat berkurang, piutang tercatat (bisa ditagih di `/piutang`). Jatuh tempo default 14 hari. Status `dikirim`. |
| Batalkan kiriman | Dapur Pusat | Hanya saat `dikirim` dan belum diterima: faktur dibatalkan (stok Pusat kembali, kas dibalik). Status `dibatalkan`. |
| Terima | Franchise | Stok outlet franchise bertambah, Barang Masuk tercatat di outlet (pemasok "Dapur Pusat", no faktur, harga franchise). Status `diterima`. |

- Franchise hanya melihat dan menindak order outletnya sendiri.
- Total order dihitung server dari harga franchise di master barang, bukan dari harga yang dikirim browser.

### F4. Monitor Franchise (baru: `/monitor-franchise`, khusus manajemen)

Ditampilkan per outlet franchise, untuk rentang tanggal tertentu:
- Omset POS dan jumlah transaksi.
- Produk terlaris.
- Nilai stok outlet (stok × harga franchise).
- Pembelian dari Dapur Pusat.
- Sisa tagihan (piutang) ke Dapur Pusat, dan order yang menunggu dikirim.

Ada juga total gabungan semua franchise.

### F5. Master Cabang

- Form tambah cabang punya pilihan **Tipe**: Cabang Sendiri atau Franchise.
- Daftar cabang menampilkan tipenya.

## 6. Kebutuhan Non-Fungsional

- Semua perubahan stok dan uang terjadi dalam `db.transaction` dan lewat `src/shared/lib/stock.ts`. Stok tidak boleh minus.
- Otorisasi dicek di server (`requireAuthRole` dan isolasi cabang). Middleware dan menu hanya lapis kedua.
- Semua tabel baru: RLS aktif, dan migrasi ditulis idempoten (`IF NOT EXISTS`).
- Setiap aksi yang mengubah data dicatat di tabel `logs`.
- Tombol simpan punya penjaga klik ganda. UI dalam bahasa Indonesia, tanpa emoji, dengan ikon `lucide-react`.

## 7. Model Data (migrasi `006_dapur_pusat_franchise.sql`)

| Tabel / kolom | Isi |
|---|---|
| `master_cabang.tipe` | `PUSAT` \| `CABANG` \| `FRANCHISE` (baris `is_pusat` diisi `PUSAT`) |
| `inventory.harga_franchise` | Harga jual Dapur Pusat ke franchise per unit |
| `resep_header` | `menu_sku` (PK), `hasil_qty`, `catatan`, `updated_by`, `updated_at` |
| `resep_biaya` | Biaya lain per batch: `menu_sku`, `nama`, `jumlah` |
| `resep_items` (sudah ada) | Takaran bahan per batch |
| `produksi` + `produksi_bahan` | Jejak produksi dan pemakaian bahan beserta harga saat itu |
| `order_franchise` + `order_franchise_items` | Order, status, `no_faktur`, jejak siapa dan kapan dikirim atau diterima |

## 8. Alur Uang

1. Bahan dibeli lewat Barang Masuk (sudah ada) dan menjadi persediaan Pusat.
2. Produksi memindahkan nilai dari persediaan bahan ke persediaan produk jadi (HPP). Tidak ada kas yang bergerak.
3. Order dikirim menghasilkan faktur tempo: persediaan Pusat turun dan piutang franchise naik (tampil di Neraca sebagai Piutang Usaha).
4. Franchise membayar: Terima Bayar di `/piutang` mencatat kas masuk ke Pusat (alur cicilan dan pelunasan yang sudah ada).
5. Franchise menjual lewat POS outletnya: kas masuk tercatat dengan `cabang` = outlet. Monitor Franchise membaca data ini.

## 9. Kriteria Penerimaan

- [ ] Resep dengan hasil 20 porsi, bahan Rp 200.000, dan biaya lain Rp 40.000 menghasilkan HPP per unit Rp 12.000.
- [ ] Produksi 2 batch memotong bahan 2× takaran dari stok Pusat, menambah 40 unit produk, dan menyimpan HPP. Kalau stok bahan kurang, produksi ditolak tanpa perubahan apa pun.
- [ ] Order franchise yang dikirim: stok Pusat berkurang, faktur tempo terbit atas nama franchise, dan piutang muncul di `/piutang`.
- [ ] Order yang diterima: stok outlet franchise bertambah, dan barang masuk tercatat di outlet itu.
- [ ] Akun franchise tidak bisa melihat atau menindak order franchise lain, dan tidak bisa mengirim order.
- [ ] Monitor Franchise menampilkan omset POS per outlet sesuai transaksi POS di outlet itu.
- [ ] Pembatalan kiriman mengembalikan stok Pusat, dan audit piutang tetap sehat.

## 10. Batasan yang Diketahui

- `inventory.harga_beli` bersifat global per SKU (HPP Dapur Pusat). Laba penjualan POS di outlet franchise di Laporan Penjualan memakai HPP Pusat, bukan harga franchise. Laba sebenarnya outlet = harga jual − harga franchise (lihat Master Resep). Perlu harga beli per cabang bila laporan laba per franchise dibutuhkan.
- Order tidak mengecek stok Dapur Pusat saat diajukan. Stok dicek saat dikirim, dan pengiriman ditolak bila stok kurang.
- Penerimaan memakai jumlah yang dikirim penuh. Selisih atau barang rusak dicatat lewat Laporan Rusak & Retur.

## 11. Rilis

1. Jalankan migrasi 006 di produksi (aman dijalankan ulang).
2. Isi harga franchise dan resep untuk produk F&B.
3. Tambah outlet franchise di `/cabang` dengan tipe Franchise.
4. Buat akun untuk setiap outlet franchise di `/users`, dengan cabang = nama outlet.
