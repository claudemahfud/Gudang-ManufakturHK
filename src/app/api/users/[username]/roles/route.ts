import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { logs, users } from '@/shared/lib/db/schema';
import { requireAuthRole } from '@/shared/lib/auth/rbac';
import { PENENTU_MULTI_ROLE, rapikanRoleTambahan } from '@/shared/lib/auth/roles';
import { errorResponse } from '@/shared/lib/stock';

// ============================================================
// PUT /api/users/[username]/roles  { rolesTambahan: UserRole[] }
// Role tambahan (multi-role) hanya ditetapkan oleh Direktur Utama.
// Role utama, password, cabang tetap dikelola Administrator di /api/users/[username].
// ============================================================
export async function PUT(req: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const authResult = await requireAuthRole([PENENTU_MULTI_ROLE]);
    if (!authResult.authorized) return authResult.response;

    const { username } = await params;
    const body = await req.json().catch(() => ({}));

    const [target] = await db
      .select({ username: users.username, role: users.role, rolesTambahan: users.rolesTambahan })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (!target) return NextResponse.json({ success: false, message: 'Pengguna tidak ditemukan' }, { status: 404 });

    const baru = rapikanRoleTambahan(body?.rolesTambahan, target.role);
    const lama = target.rolesTambahan ?? [];

    const [updated] = await db
      .update(users)
      .set({ rolesTambahan: baru, updatedAt: new Date() })
      .where(eq(users.username, username))
      .returning({ username: users.username, role: users.role, rolesTambahan: users.rolesTambahan });

    const pelaku = authResult.user?.name || authResult.user?.username || 'Direktur Utama';
    const ditambah = baru.filter((r) => !lama.includes(r));
    const dicabut = lama.filter((r) => !(baru as string[]).includes(r));
    await db.insert(logs).values({
      user: pelaku,
      aksi: 'UBAH_MULTI_ROLE',
      detail:
        `Role tambahan ${username} (utama: ${target.role}): ${baru.length ? baru.join(', ') : 'tidak ada'}` +
        (ditambah.length ? `. Ditambah: ${ditambah.join(', ')}` : '') +
        (dicabut.length ? `. Dicabut: ${dicabut.join(', ')}` : ''),
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return errorResponse(err, 'USER_ROLES_PUT');
  }
}
