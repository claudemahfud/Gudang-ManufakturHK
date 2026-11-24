import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { users, logs } from '@/shared/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from '@/shared/lib/auth/password';
import { requireAuthRole } from '@/shared/lib/auth/rbac';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    // Administrator sebagai role utama atau role tambahan (dibaca segar dari DB)
    const authResult = await requireAuthRole(['Administrator']);
    if (!authResult.authorized) return authResult.response;
    const session = { user: authResult.user };

    const { username } = await params;
    const body = await req.json();
    const { namaLengkap, role, email, password, aktif } = body;

    const updateData: any = {
      namaLengkap,
      role,
      // Role utama yang baru tidak perlu tercatat lagi sebagai role tambahan
      ...(role ? { rolesTambahan: sql`array_remove(${users.rolesTambahan}, ${String(role)})` } : {}),
      email: email || null,
      aktif: typeof aktif === 'boolean' ? aktif : true,
      updatedAt: new Date(),
    };

    if (body.divisiAssigned) {
      updateData.divisiAssigned = body.divisiAssigned;
    }
    if (body.cabang) {
      updateData.cabang = body.cabang;
    }

    if (password && password.trim().length > 0) {
      updateData.passwordHash = await hashPassword(password);
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.username, username))
      .returning();

    const currentUser = (session.user as any)?.name || (session.user as any)?.username || 'Admin';
    await db.insert(logs).values({
      user: currentUser,
      aksi: 'UPDATE_USER',
      detail: `Mengubah data pengguna ${username} (Role: ${role}, Aktif: ${updateData.aktif})`,
    });

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
    // Administrator sebagai role utama atau role tambahan (dibaca segar dari DB)
    const authResult = await requireAuthRole(['Administrator']);
    if (!authResult.authorized) return authResult.response;
    const session = { user: authResult.user };

    const { username } = await params;

    // Jangan izinkan hapus akun sendiri
    if ((session.user as any)?.username === username) {
      return NextResponse.json(
        { success: false, message: 'Tidak dapat menghapus akun Anda sendiri' },
        { status: 400 }
      );
    }

    await db.delete(users).where(eq(users.username, username));

    const currentUser = (session.user as any)?.name || (session.user as any)?.username || 'Admin';
    await db.insert(logs).values({
      user: currentUser,
      aksi: 'HAPUS_USER',
      detail: `Menghapus pengguna: ${username}`,
    });

    return NextResponse.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
