-- 015: kolom divisi biaya operasional (ada di schema.ts sejak awal tetapi belum pernah dibuat di DB).
-- Biaya kini milik satu entitas (MANUFAKTUR / FNB) dan dijurnal ke buku entitas itu.
ALTER TABLE biaya_operasional ADD COLUMN IF NOT EXISTS divisi varchar(30) NOT NULL DEFAULT 'MANUFAKTUR';
