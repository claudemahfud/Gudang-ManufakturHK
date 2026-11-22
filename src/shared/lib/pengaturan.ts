import crypto from 'crypto';
import { and, count, eq, gt } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { logs, pengaturanPerusahaan } from '@/shared/lib/db/schema';
import { BusinessError } from '@/shared/lib/stock';

// ============================================================
// PENGATURAN PERUSAHAAN — PIN supervisor (server only)
// Direktur Utama menentukan apakah aksi sensitif wajib PIN.
// ============================================================

export type Pengaturan = typeof pengaturanPerusahaan.$inferSelect;

export const DEFAULT_PENGATURAN: Pengaturan = {
  id: 1,
  wajibPin: false,
  maxDiskonTanpaPin: 15,
  pinVoidCart: true,
  pinHapusTransaksi: true,
  pinHash: null,
  updatedBy: null,
  updatedAt: null,
};

const PIN_MAX_FAILS = 5;
const PIN_WINDOW_MS = 15 * 60 * 1000;

export async function getPengaturan(): Promise<Pengaturan> {
  try {
    const [row] = await db.select().from(pengaturanPerusahaan).where(eq(pengaturanPerusahaan.id, 1)).limit(1);
    return row ?? DEFAULT_PENGATURAN;
  } catch (err) {
    // Tabel belum dibuat (migrasi 002 belum dijalankan): perlakukan sebagai belum dikonfigurasi
    if ((err as { code?: string })?.code === '42P01' || (err as { cause?: { code?: string } })?.cause?.code === '42P01') {
      console.error('[PENGATURAN] Tabel pengaturan_perusahaan belum ada. Jalankan supabase/migrations/002_pengaturan_perusahaan.sql');
      return DEFAULT_PENGATURAN;
    }
    throw err;
  }
}

/** Pengaturan tanpa hash PIN, aman dikirim ke browser. */
export function publicPengaturan(p: Pengaturan) {
  return {
    wajibPin: p.wajibPin,
    maxDiskonTanpaPin: p.maxDiskonTanpaPin,
    pinVoidCart: p.pinVoidCart,
    pinHapusTransaksi: p.pinHapusTransaksi,
    pinSudahDiatur: Boolean(p.pinHash),
    updatedBy: p.updatedBy,
    updatedAt: p.updatedAt,
  };
}

export function isValidPinFormat(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin);
}

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pin, salt, 32);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function pinMatches(pin: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(pin, Buffer.from(saltB64, 'base64'), expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function recentPinFails(actor: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(logs)
    .where(and(eq(logs.user, actor), eq(logs.aksi, 'PIN_GAGAL'), gt(logs.createdAt, new Date(Date.now() - PIN_WINDOW_MS))));
  return Number(row?.n ?? 0);
}

/**
 * Periksa PIN supervisor. Maks 5 PIN salah per pengguna per 15 menit
 * (dicatat di logs sebagai PIN_GAGAL). Lempar BusinessError bila gagal.
 */
export async function assertSupervisorPin(p: Pengaturan, pin: unknown, actor: string, aksi: string) {
  if (!p.pinHash) {
    throw new BusinessError('PIN supervisor belum diatur Direktur di Pengaturan Perusahaan.', 403);
  }
  if ((await recentPinFails(actor)) >= PIN_MAX_FAILS) {
    throw new BusinessError('Terlalu banyak PIN salah. Coba lagi 15 menit lagi.', 429);
  }
  if (!isValidPinFormat(pin) || !pinMatches(pin, p.pinHash)) {
    await db.insert(logs).values({ user: actor, aksi: 'PIN_GAGAL', detail: `PIN supervisor salah untuk: ${aksi}` });
    throw new BusinessError('PIN Supervisor salah! Akses otorisasi ditolak.', 403);
  }
}
