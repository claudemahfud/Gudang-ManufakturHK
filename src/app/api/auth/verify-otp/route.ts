import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { users, otpCodes, logs } from '@/shared/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import crypto from 'crypto';

function sha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export async function POST(req: Request) {
  try {
    const { email, otp, newPassword } = await req.json();

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

    const hashedInputOtp = sha256(otp);
    const now = new Date();

    // Verifikasi OTP di tabel
    const [validOtp] = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.email, email.trim().toLowerCase()),
          eq(otpCodes.otpHash, hashedInputOtp),
          eq(otpCodes.used, false),
          gt(otpCodes.expiresAt, now)
        )
      )
      .limit(1);

    if (!validOtp) {
      return NextResponse.json(
        { success: false, message: 'Kode OTP tidak valid atau telah kadaluarsa' },
        { status: 400 }
      );
    }

    const passwordHash = sha256(newPassword);

    await db.transaction(async (tx) => {
      // Tandai OTP used
      await tx
        .update(otpCodes)
        .set({ used: true })
        .where(eq(otpCodes.id, validOtp.id));

      // Update password pengguna
      await tx
        .update(users)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.email, email.trim().toLowerCase()));

      await tx.insert(logs).values({
        user: email.trim().toLowerCase(),
        aksi: 'RESET_PASSWORD',
        detail: `Pengguna me-reset password via OTP email`,
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Password berhasil direset! Silakan login kembali.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
