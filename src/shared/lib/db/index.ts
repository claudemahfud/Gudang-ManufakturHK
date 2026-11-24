import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// ============================================================
// DATABASE CLIENT — Drizzle ORM + PostgreSQL (Supabase)
// ============================================================

/**
 * Supabase pooler mode session (port 5432) hanya melayani 15 klien: instance serverless yang
 * banyak membuatnya penuh ("EMAXCONNSESSION max clients reached") dan semua query gagal.
 * Untuk host pooler, pakai mode transaction (port 6543: ratusan klien). Aman karena
 * prepare:false dan semua kode memakai db.transaction (satu koneksi per transaksi).
 * Set DB_POOLER_SESSION=1 untuk menahan mode session.
 */
function alamatDb(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('.pooler.supabase.com') && (u.port === '' || u.port === '5432') && process.env.DB_POOLER_SESSION !== '1') {
      u.port = '6543';
      return u.toString();
    }
  } catch {
    // URL tidak bisa diurai: pakai apa adanya
  }
  return url;
}

const connectionString = alamatDb(process.env.DATABASE_URL!);

// prepare: false wajib di pooler transaction mode.
// Serverless: tiap instance cukup sedikit koneksi dan segera dilepas saat diam.
const client = postgres(connectionString, {
  prepare: false,
  max: Number(process.env.DB_POOL_MAX) || 3,
  idle_timeout: 20,
  connect_timeout: 15,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
