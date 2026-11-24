-- ============================================================
-- 010: Nomor urut harian per jenis dokumen
-- Format nomor: PREFIX-BBTT-NNN (bulan, tanggal, seri 3 digit), seri kembali
-- ke 001 setiap hari (zona waktu Asia/Jakarta). Satu baris per prefix per tanggal;
-- nomor diambil dengan INSERT ... ON CONFLICT DO UPDATE agar aman bila bersamaan.
-- ============================================================

CREATE TABLE IF NOT EXISTS nomor_urut (
  prefix   varchar(10) NOT NULL,
  tanggal  date        NOT NULL,
  terakhir integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, tanggal)
);

ALTER TABLE nomor_urut ENABLE ROW LEVEL SECURITY;
