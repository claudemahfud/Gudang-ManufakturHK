import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { db } from '@/shared/lib/db';
import { users, logs } from '@/shared/lib/db/schema';
import { and, count, eq, gt } from 'drizzle-orm';
import { hashPassword, verifyPassword } from './password';
import { rolesOf } from './roles';

// ============================================================
// FULL NEXTAUTH CONFIG (Node.js runtime only)
// Menggunakan database & password hashing
// ============================================================

const LOGIN_MAX_FAILS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

async function recentLoginFails(username: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(logs)
    .where(
      and(
        eq(logs.user, username),
        eq(logs.aksi, 'LOGIN_GAGAL'),
        gt(logs.createdAt, new Date(Date.now() - LOGIN_WINDOW_MS))
      )
    );
  return Number(row?.n ?? 0);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const username = String(credentials.username).trim().toLowerCase().slice(0, 50);
        const password = String(credentials.password);

        // Batasi tebakan password: maks LOGIN_MAX_FAILS gagal per username per 15 menit
        if ((await recentLoginFails(username)) >= LOGIN_MAX_FAILS) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        const { ok, needsRehash } = await verifyPassword(password, user?.passwordHash);

        if (!user || !ok || !user.aktif) {
          await db.insert(logs).values({
            user: username,
            aksi: 'LOGIN_GAGAL',
            detail: 'Percobaan login gagal',
          });
          return null;
        }

        // Migrasi otomatis hash SHA-256 lama ke scrypt saat login berhasil
        if (needsRehash) {
          await db
            .update(users)
            .set({ passwordHash: await hashPassword(password) })
            .where(eq(users.id, user.id));
        }

        return {
          id: user.id,
          name: user.namaLengkap,
          email: user.email ?? '',
          username: user.username,
          role: user.role,
          roles: rolesOf({ role: user.role, roles: user.rolesTambahan }),
          divisiAssigned: user.divisiAssigned || 'ALL',
          cabang: user.cabang || 'Pusat',
        };
      },
    }),
  ],
});
