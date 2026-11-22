import crypto from 'crypto';
import { and, count, eq, gt } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { logs, otpCodes } from '@/shared/lib/db/schema';

// ============================================================
// OTP RESET PASSWORD — aturan & batas percobaan (Node.js only)
// Batas dihitung dari tabel yang sudah ada (otp_codes & logs)
// sehingga berlaku lintas instance serverless tanpa tabel baru.
// ============================================================

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_WINDOW_MS = 15 * 60 * 1000;
export const OTP_MAX_REQUESTS = 3; // permintaan kode per email per jendela
export const OTP_MAX_FAILS = 5; // tebakan salah per email per jendela

export const OTP_FAIL_ACTION = 'OTP_GAGAL';

export function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase().slice(0, 100) : '';
}

export function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export async function recentOtpRequests(email: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(otpCodes)
    .where(and(eq(otpCodes.email, email), gt(otpCodes.createdAt, new Date(Date.now() - OTP_WINDOW_MS))));
  return Number(row?.n ?? 0);
}

export async function recentOtpFails(email: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(logs)
    .where(
      and(
        eq(logs.user, email.slice(0, 50)),
        eq(logs.aksi, OTP_FAIL_ACTION),
        gt(logs.createdAt, new Date(Date.now() - OTP_WINDOW_MS))
      )
    );
  return Number(row?.n ?? 0);
}

/**
 * Kirim OTP lewat Resend (RESEND_API_KEY + EMAIL_FROM).
 * Tanpa konfigurasi: di production tidak mengirim apa pun dan kode
 * TIDAK pernah ditulis ke log; di development kode ditampilkan di konsol.
 */
export async function deliverOtp(email: string, code: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (apiKey && from) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Kode reset password Gudang Manufaktur HK',
        text: `Kode OTP Anda: ${code}\n\nBerlaku 10 menit. Abaikan email ini bila Anda tidak meminta reset password.`,
      }),
    });
    if (!res.ok) {
      console.error('[AUTH OTP] Gagal mengirim email OTP, status', res.status);
      return false;
    }
    return true;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[AUTH OTP][DEV] ${email} -> ${code}`);
    return true;
  }

  console.error('[AUTH OTP] RESEND_API_KEY / EMAIL_FROM belum di-set; OTP tidak terkirim.');
  return false;
}
