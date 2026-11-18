import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { users, otpCodes } from '@/shared/lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

function sha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ success: false, message: 'Email wajib diisi' }, { status: 400 });
    }

    // Cek apakah ada user dengan email ini
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Email tidak terdaftar dalam sistem' },
        { status: 404 }
      );
    }

    // Generate 6 digit OTP
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = sha256(rawOtp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

    await db.insert(otpCodes).values({
      email: email.trim().toLowerCase(),
      otpHash,
      expiresAt,
      used: false,
    });

    // Logging console OTP untuk testing lokal
    console.log(`[AUTH OTP] Email: ${email} | Code: ${rawOtp} (Valid 10 mins)`);

    return NextResponse.json({
      success: true,
      message: 'Kode OTP telah berhasil dikirimkan ke email Anda',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
