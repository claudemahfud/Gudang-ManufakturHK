import type { NextAuthConfig } from 'next-auth';

// ============================================================
// EDGE-COMPATIBLE NEXTAUTH CONFIG
// Tidak mengimpor db/postgres/crypto agar bisa jalan di Edge runtime
// ============================================================

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.username = (user as any).username;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).username = token.username;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 jam
  },
  providers: [],
} satisfies NextAuthConfig;
