-- Pengaturan perusahaan (satu baris). Jalankan di Supabase SQL Editor.
-- Default: PIN supervisor NONAKTIF sampai Direktur Utama mengaktifkannya
-- di halaman Pengaturan Perusahaan.
CREATE TABLE IF NOT EXISTS pengaturan_perusahaan (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  wajib_pin boolean NOT NULL DEFAULT false,
  max_diskon_tanpa_pin integer NOT NULL DEFAULT 15 CHECK (max_diskon_tanpa_pin BETWEEN 0 AND 100),
  pin_void_cart boolean NOT NULL DEFAULT true,
  pin_hapus_transaksi boolean NOT NULL DEFAULT true,
  pin_hash text,
  updated_by varchar(50),
  updated_at timestamp DEFAULT now()
);

INSERT INTO pengaturan_perusahaan (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Tabel hanya diakses server lewat koneksi Postgres langsung; tutup akses anon/REST.
ALTER TABLE pengaturan_perusahaan ENABLE ROW LEVEL SECURITY;
