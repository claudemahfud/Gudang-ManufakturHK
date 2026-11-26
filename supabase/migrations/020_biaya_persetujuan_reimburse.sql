-- ============================================================
-- 020: Biaya operasional seluruh karyawan + persetujuan Finance Pusat + reimburse
-- - input oleh karyawan berstatus 'menunggu'; dijurnal saat Finance Pusat menyetujui
--   (nota fisik diterima + foto terlampir).
-- - sumber: penjualan (kredit 1-1350) | kantor (kredit Kas/Bank) | pribadi (kredit 2-1500).
-- - reimburse: Dr 2-1500, Cr Kas/Bank -> status 'dibayar'.
-- Kolom setoran 019 (biaya, total_biaya, setoran_id) tidak dipakai lagi, dibiarkan agar versi lama tetap jalan saat deploy.
-- ============================================================

ALTER TABLE biaya_operasional
  ADD COLUMN IF NOT EXISTS no_biaya        varchar(30),
  ADD COLUMN IF NOT EXISTS username        varchar(50),
  ADD COLUMN IF NOT EXISTS sumber          varchar(20) NOT NULL DEFAULT 'kantor',
  ADD COLUMN IF NOT EXISTS status          varchar(20) NOT NULL DEFAULT 'disetujui',
  ADD COLUMN IF NOT EXISTS nota_fisik      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS diproses_oleh   varchar(50),
  ADD COLUMN IF NOT EXISTS diproses_at     timestamp,
  ADD COLUMN IF NOT EXISTS alasan_tolak    text,
  ADD COLUMN IF NOT EXISTS reimburse_oleh  varchar(50),
  ADD COLUMN IF NOT EXISTS reimburse_at    timestamp,
  ADD COLUMN IF NOT EXISTS reimburse_metode varchar(20);

ALTER TABLE biaya_operasional DROP CONSTRAINT IF EXISTS biaya_operasional_sumber_check;
ALTER TABLE biaya_operasional ADD CONSTRAINT biaya_operasional_sumber_check
  CHECK (sumber IN ('penjualan','kantor','pribadi'));
ALTER TABLE biaya_operasional DROP CONSTRAINT IF EXISTS biaya_operasional_status_check;
ALTER TABLE biaya_operasional ADD CONSTRAINT biaya_operasional_status_check
  CHECK (status IN ('menunggu','disetujui','ditolak','dibatalkan','dibayar'));
CREATE UNIQUE INDEX IF NOT EXISTS biaya_operasional_no_biaya_key ON biaya_operasional (no_biaya) WHERE no_biaya IS NOT NULL;
CREATE INDEX IF NOT EXISTS biaya_operasional_username_idx ON biaya_operasional (username, status);

CREATE TABLE IF NOT EXISTS biaya_lampiran (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  biaya_id   uuid        NOT NULL REFERENCES biaya_operasional(id) ON DELETE CASCADE,
  jenis      varchar(10) NOT NULL DEFAULT 'nota' CHECK (jenis IN ('nota','bayar')),
  data       text        NOT NULL, -- data URL JPEG yang sudah dikecilkan di browser
  oleh       varchar(50) NOT NULL,
  created_at timestamp   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS biaya_lampiran_biaya_idx ON biaya_lampiran (biaya_id);
-- akses hanya lewat server aplikasi
ALTER TABLE biaya_lampiran ENABLE ROW LEVEL SECURITY;

INSERT INTO akun (kode, nama, tipe, saldo_normal, induk, kelompok, arus_kas, posting, urutan)
SELECT '2-1500', 'Hutang Reimburse Karyawan', tipe, saldo_normal, induk, kelompok, arus_kas, true, urutan + 1
FROM akun WHERE kode = '2-1400'
ON CONFLICT (kode) DO NOTHING;
