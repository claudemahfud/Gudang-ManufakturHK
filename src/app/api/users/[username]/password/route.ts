import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { logs, users } from '@/shared/lib/db/schema';
import { requireAuthRole } from '@/shared/lib/auth/rbac';
import { hashPassword } from '@/shared/lib/auth/password';
import { errorResponse } from '@/shared/lib/stock';

// ============================================================
// PUT /api/users/[username]/password  { password }
// Administrator mengganti password akun mana pun. Hanya password yang berubah;
// password tidak pernah dikembalikan atau ditulis ke log.
// ============================================================
const MIN = 6;
const MAX = 128;

export async function PUT(req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const authResult = await requireAuthRole(['Administrator']);
    if (!authResult.authorized) return authResult.response;

    const { username } = await params;
    const body = await req.json().catch(() => ({}));
    const password = typeof body?.password === 'string' ? body.password : '';
    if (password.length < MIN || password.length > MAX) {
      return NextResponse.json(
        { success: false, message: `Password baru harus ${MIN}-${MAX} karakter` },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(users)
      .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
      .where(eq(users.username, username))
      .returning({ username: users.username });
    if (!updated) return NextResponse.json({ success: false, message: 'Pengguna tidak ditemukan' }, { status: 404 });

    await db.insert(logs).values({
      user: authResult.user?.name || authResult.user?.username || 'Administrator',
      aksi: 'RESET_PASSWORD_USER',
      detail: `Administrator mengganti password akun @${username}`,
    });

    return NextResponse.json({ success: true, message: `Password @${username} berhasil diganti` });
  } catch (err) {
    return errorResponse(err, 'USER_PASSWORD_PUT');
  }
}
