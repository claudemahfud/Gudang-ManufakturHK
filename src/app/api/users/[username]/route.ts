import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { users, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

function sha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const session = await auth();
    if (!session || (session.user as any)?.role !== 'Administrator') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const { username } = await params;
    const body = await req.json();
    const { namaLengkap, role, email, password, aktif } = body;

    const updateData: any = {
      namaLengkap,
      role,
      email: email || null,
      aktif: typeof aktif === 'boolean' ? aktif : true,
      updatedAt: new Date(),
    };

    if (password && password.trim().length > 0) {
      updateData.passwordHash = sha256(password);
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.username, username))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const session = await auth();
    if (!session || (session.user as any)?.role !== 'Administrator') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const { username } = await params;

    // Jangan izinkan hapus akun sendiri
    if ((session.user as any)?.username === username) {
      return NextResponse.json(
        { success: false, message: 'Tidak dapat menghapus akun Anda sendiri' },
        { status: 400 }
      );
    }

    await db.delete(users).where(eq(users.username, username));

    return NextResponse.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
