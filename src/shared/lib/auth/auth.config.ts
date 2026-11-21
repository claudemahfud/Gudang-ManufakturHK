import type { NextAuthConfig } from 'next-auth';

// ============================================================
// EDGE-COMPATIBLE NEXTAUTH CONFIG
// Tidak mengimpor db/postgres/crypto agar bisa jalan di Edge runtime
// ============================================================

export const authConfig = {
  // Tanpa fallback: bila secret kosong, NextAuth menolak berjalan (MissingSecret)
  // alih-alih menandatangani sesi dengan kunci yang tertulis di repo publik.
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.username = (user as any).username;
        token.role = (user as any).role;
        token.divisiAssigned = (user as any).divisiAssigned || 'ALL';
        token.cabang = (user as any).cabang || 'Pusat';
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).username = token.username;
        (session.user as any).role = token.role;
        (session.user as any).divisiAssigned = token.divisiAssigned || 'ALL';
        (session.user as any).cabang = token.cabang || 'Pusat';
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
