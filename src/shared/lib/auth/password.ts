import crypto from 'crypto';
import { promisify } from 'util';

// ============================================================
// PASSWORD & TOKEN HASHING (Node.js runtime only)
// Format baru : scrypt$N$r$p$<salt-base64>$<hash-base64>
// Format lama : SHA-256 hex tanpa salt (64 karakter) -> masih diterima
//               saat login, lalu otomatis di-hash ulang ke scrypt.
// ============================================================

const scryptAsync = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const LEGACY_SHA256 = /^[a-f0-9]{64}$/i;

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64'), hash.toString('base64')].join('$');
}

export interface VerifyResult {
  ok: boolean;
  /** true bila hash tersimpan masih format lama dan perlu diganti scrypt */
  needsRehash: boolean;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<VerifyResult> {
  if (!stored) return { ok: false, needsRehash: false };

  if (stored.startsWith('scrypt$')) {
    const [, n, r, p, saltB64, hashB64] = stored.split('$');
    const N = Number(n);
    const R = Number(r);
    const P = Number(p);
    if (!N || !R || !P || !saltB64 || !hashB64) return { ok: false, needsRehash: false };
    const expected = Buffer.from(hashB64, 'base64');
    const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, {
      N,
      r: R,
      p: P,
      maxmem: 128 * N * R * 2,
    });
    const ok = safeEqual(actual, expected);
    const outdated = N !== SCRYPT_N || R !== SCRYPT_R || P !== SCRYPT_P;
    return { ok, needsRehash: ok && outdated };
  }

  if (LEGACY_SHA256.test(stored)) {
    const ok = safeEqual(Buffer.from(sha256Hex(password), 'hex'), Buffer.from(stored, 'hex'));
    return { ok, needsRehash: ok };
  }

  return { ok: false, needsRehash: false };
}

/** Bandingkan hash token (mis. OTP) dalam waktu konstan. */
export function tokenHashEquals(rawToken: string, storedHex: string): boolean {
  if (!LEGACY_SHA256.test(storedHex)) return false;
  return safeEqual(Buffer.from(sha256Hex(rawToken), 'hex'), Buffer.from(storedHex, 'hex'));
}
