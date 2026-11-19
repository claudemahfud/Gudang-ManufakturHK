import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { db } from '@/shared/lib/db';
import { users } from '@/shared/lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// ============================================================
// FULL NEXTAUTH CONFIG (Node.js runtime only)
// Menggunakan database & password hashing
// ============================================================

function sha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
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

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, credentials.username as string))
          .limit(1);

        if (!user || !user.aktif) return null;

        const passwordHash = sha256(credentials.password as string);
        if (passwordHash !== user.passwordHash) return null;

        return {
          id: user.id,
          name: user.namaLengkap,
          email: user.email ?? '',
          username: user.username,
          role: user.role,
          divisiAssigned: user.divisiAssigned || 'ALL',
          cabang: user.cabang || 'Pusat',
        };
      },
    }),
  ],
});
