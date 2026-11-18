import NextAuth from 'next-auth';
import { authConfig } from '@/shared/lib/auth/auth.config';
import { NextResponse } from 'next/server';
import { ROUTES } from '@/router/routes';

// ============================================================
// MIDDLEWARE — Edge-compatible Auth Guard + Role Based
// ============================================================

const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = [ROUTES.LOGIN, ROUTES.FORGOT_PASSWORD, '/api/public'];

const ROUTE_ROLES: Record<string, string[]> = {
  [ROUTES.USERS]: ['Administrator'],
  [ROUTES.LOGS]: ['Administrator', 'Manager', 'Direktur Utama'],
  [ROUTES.KEUANGAN]: ['Administrator', 'Manager', 'Direktur Utama', 'Kepala Gudang'],
  [ROUTES.BIAYA_OPERASIONAL]: ['Administrator', 'Manager', 'Direktur Utama'],
  [ROUTES.TARGET_KOMISI]: ['Administrator', 'Manager', 'Direktur Utama', 'Admin Salesman'],
  [ROUTES.MONITOR_SALESMAN]: ['Administrator', 'Manager', 'Direktur Utama', 'Admin Salesman'],
  [ROUTES.PENGAJUAN_DISKON]: ['Administrator', 'Manager', 'Direktur Utama', 'Admin Salesman', 'Salesman', 'Staff Admin Salesman'],
};

export default auth((req: any) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Izinkan route publik dan api internal NextAuth
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Redirect ke login bila belum authenticated
  if (!session) {
    const loginUrl = new URL(ROUTES.LOGIN, req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cek otorisasi role
  const userRole = (session.user as any)?.role;
  const allowedRoles = ROUTE_ROLES[pathname];

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return NextResponse.redirect(new URL(ROUTES.DASHBOARD, req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/public|api/auth).*)'],
};
