import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { users, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

function sha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// ============================================================
// API: /api/profile
// GET: Ambil detail profil akun sesi saat ini
// PUT: Update nama, email, atau ganti password
// ============================================================

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const username = (session.user as any).username;
    if (!username) {
      return NextResponse.json({ success: false, message: 'Sesi pengguna tidak valid' }, { status: 400 });
    }

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        namaLengkap: users.namaLengkap,
        role: users.role,
        email: users.email,
        divisiAssigned: users.divisiAssigned,
        cabang: users.cabang,
        aktif: users.aktif,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      return NextResponse.json({ success: false, message: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const username = (session.user as any).username;
    const body = await req.json();
    const { namaLengkap, email, currentPassword, newPassword } = body;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      return NextResponse.json({ success: false, message: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (namaLengkap && typeof namaLengkap === 'string') {
      updateData.namaLengkap = namaLengkap.trim();
    }

    if (email !== undefined) {
      updateData.email = email ? email.trim() : null;
    }

    // Jika ganti password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, message: 'Password saat ini wajib diisi untuk verifikasi keamanan' },
          { status: 400 }
        );
      }

      const curHash = sha256(currentPassword);
      if (curHash !== user.passwordHash) {
        return NextResponse.json(
          { success: false, message: 'Password saat ini salah' },
          { status: 400 }
        );
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { success: false, message: 'Password baru minimal 6 karakter' },
          { status: 400 }
        );
      }

      updateData.passwordHash = sha256(newPassword);
    }

    await db.update(users).set(updateData).where(eq(users.id, user.id));

    // Audit log
    await db.insert(logs).values({
      user: user.username,
      aksi: 'UPDATE_PROFILE',
      detail: `Pengguna @${user.username} memperbarui profil akun${newPassword ? ' dan mengganti password' : ''}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Profil akun berhasil diperbarui',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
