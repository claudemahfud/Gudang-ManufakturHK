import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { users, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { desc, eq } from 'drizzle-orm';
import crypto from 'crypto';

function sha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// ============================================================
// API: /api/users
// GET (list pengguna) + POST (tambah pengguna baru)
// ============================================================

export async function GET() {
  try {
    const session = await auth();
    if (!session || (session.user as any)?.role !== 'Administrator') {
      return NextResponse.json({ success: false, message: 'Hanya Administrator yang berhak' }, { status: 403 });
    }

    const list = await db
      .select({
        id: users.id,
        username: users.username,
        namaLengkap: users.namaLengkap,
        role: users.role,
        email: users.email,
        aktif: users.aktif,
        divisiAssigned: users.divisiAssigned,
        cabang: users.cabang,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ success: true, data: list });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || (session.user as any)?.role !== 'Administrator') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { username, namaLengkap, role, email, password } = body;

    if (!username || !namaLengkap || !role || !password) {
      return NextResponse.json(
        { success: false, message: 'Username, Nama, Role, dan Password wajib diisi' },
        { status: 400 }
      );
    }

    // Cek username unik
    const [exist] = await db
      .select()
      .from(users)
      .where(eq(users.username, username.trim().toLowerCase()))
      .limit(1);

    if (exist) {
      return NextResponse.json(
        { success: false, message: 'Username sudah digunakan, silakan pilih yang lain' },
        { status: 400 }
      );
    }

    const passwordHash = sha256(password);
    const [newUser] = await db
      .insert(users)
      .values({
        username: username.trim().toLowerCase(),
        namaLengkap,
        role,
        email: email || null,
        passwordHash,
        divisiAssigned: body.divisiAssigned || (['Administrator', 'Direktur Utama', 'Manager'].includes(role) ? 'ALL' : 'MANUFAKTUR'),
        cabang: body.cabang || 'Pusat',
        aktif: true,
      })
      .returning({
        id: users.id,
        username: users.username,
        namaLengkap: users.namaLengkap,
        role: users.role,
        email: users.email,
        divisiAssigned: users.divisiAssigned,
        cabang: users.cabang,
        aktif: users.aktif,
      });

    const admin = (session.user as any)?.name || 'Admin';
    await db.insert(logs).values({
      user: admin,
      aksi: 'TAMBAH_USER',
      detail: `Membuat user baru: ${username} (Role: ${role})`,
    });

    return NextResponse.json({ success: true, data: newUser }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
