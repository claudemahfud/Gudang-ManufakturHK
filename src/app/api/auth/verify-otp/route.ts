import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { users, otpCodes, logs } from '@/shared/lib/db/schema';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { hashPassword, tokenHashEquals } from '@/shared/lib/auth/password';
import { OTP_FAIL_ACTION, OTP_MAX_FAILS, OTP_WINDOW_MS, normalizeEmail } from '@/shared/lib/auth/otp';
import { ambilJatah, kembalikanJatah } from '@/shared/lib/auth/percobaan';

const invalidOtp = () =>
  NextResponse.json(
    { success: false, message: 'Kode OTP tidak valid atau telah kadaluarsa' },
    { status: 400 }
  );

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body?.email);
    const otp = typeof body?.otp === 'string' ? body.otp.trim() : String(body?.otp ?? '').trim();
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

    if (!email || !otp || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Email, OTP, dan Password baru wajib diisi' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password minimal 6 karakter' },
        { status: 400 }
      );
    }

    // Kunci sementara setelah terlalu banyak tebakan salah
    const jatah = await ambilJatah(email, OTP_FAIL_ACTION, OTP_MAX_FAILS, OTP_WINDOW_MS, 'Verifikasi OTP reset password gagal');
    if (!jatah) {
      await db
        .update(otpCodes)
        .set({ used: true })
        .where(and(eq(otpCodes.email, email), eq(otpCodes.used, false)));
      return NextResponse.json(
        { success: false, message: 'Terlalu banyak percobaan. Minta kode OTP baru setelah 15 menit.' },
        { status: 429 }
      );
    }

    // Hanya kode terbaru yang masih berlaku
    const [activeOtp] = await db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.email, email), eq(otpCodes.used, false), gt(otpCodes.expiresAt, new Date())))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);

    if (!activeOtp || !/^\d{6}$/.test(otp) || !tokenHashEquals(otp, activeOtp.otpHash)) {
      return invalidOtp();
    }

    // Reset hanya untuk tepat satu akun pemilik email
    const matches = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(2);

    if (matches.length !== 1) {
      return invalidOtp();
    }
    const target = matches[0];

    const passwordHash = await hashPassword(newPassword);

    const consumed = await db.transaction(async (tx) => {
      // Tandai OTP terpakai secara atomik: request ganda hanya satu yang lolos
      const used = await tx
        .update(otpCodes)
        .set({ used: true })
        .where(and(eq(otpCodes.id, activeOtp.id), eq(otpCodes.used, false)))
        .returning({ id: otpCodes.id });
      if (used.length === 0) return false;

      await tx
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, target.id));

      await tx.insert(logs).values({
        user: target.username,
        aksi: 'RESET_PASSWORD',
        detail: 'Pengguna me-reset password via OTP email',
      });
      return true;
    });

    if (!consumed) return invalidOtp();
    await kembalikanJatah(jatah.id);

    return NextResponse.json({
      success: true,
      message: 'Password berhasil direset! Silakan login kembali.',
    });
  } catch (err) {
    console.error('[AUTH OTP] verify-otp error', err);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server. Coba lagi nanti.' },
      { status: 500 }
    );
  }
}
