import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { users, otpCodes } from '@/shared/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { sha256Hex } from '@/shared/lib/auth/password';
import {
  OTP_MAX_REQUESTS,
  OTP_TTL_MS,
  deliverOtp,
  generateOtp,
  normalizeEmail,
  recentOtpRequests,
} from '@/shared/lib/auth/otp';

// Respons selalu sama agar tidak bisa dipakai menebak email terdaftar.
const GENERIC_RESPONSE = {
  success: true,
  message: 'Jika email terdaftar, kode OTP telah dikirimkan ke email tersebut.',
};

export async function POST(req: Request) {
  try {
    const { email: rawEmail } = await req.json();
    const email = normalizeEmail(rawEmail);
    if (!email) {
      return NextResponse.json({ success: false, message: 'Email wajib diisi' }, { status: 400 });
    }

    const matches = await db
      .select({ id: users.id, aktif: users.aktif })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(2);

    // Hanya kirim bila email menunjuk tepat satu akun aktif
    if (matches.length !== 1 || !matches[0].aktif) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const rawOtp = generateOtp();

    const dibuat = await db.transaction(async (tx) => {
      // hitung & simpan di bawah satu kunci: permintaan serentak tidak melewati batas
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'otp:' + email}))`);
      if ((await recentOtpRequests(tx, email)) >= OTP_MAX_REQUESTS) return false;
      // Kode lama tidak berlaku lagi begitu kode baru diminta
      await tx
        .update(otpCodes)
        .set({ used: true })
        .where(and(eq(otpCodes.email, email), eq(otpCodes.used, false)));

      await tx.insert(otpCodes).values({
        email,
        otpHash: sha256Hex(rawOtp),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        used: false,
      });
      return true;
    });

    if (dibuat) await deliverOtp(email, rawOtp);

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (err) {
    console.error('[AUTH OTP] request-otp error', err);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server. Coba lagi nanti.' },
      { status: 500 }
    );
  }
}
