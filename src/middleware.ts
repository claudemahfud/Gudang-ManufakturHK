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
  // Page routes
  [ROUTES.USERS]: ['Administrator'],
  [ROUTES.LOGS]: ['Administrator', 'Manager', 'Direktur Utama'],
  [ROUTES.KEUANGAN]: ['Administrator', 'Manager', 'Direktur Utama', 'Kepala Gudang'],
  [ROUTES.BIAYA_OPERASIONAL]: ['Administrator', 'Manager', 'Direktur Utama'],
  [ROUTES.TARGET_KOMISI]: ['Administrator', 'Manager', 'Direktur Utama', 'Admin Salesman'],
  [ROUTES.MONITOR_SALESMAN]: ['Administrator', 'Manager', 'Direktur Utama', 'Admin Salesman'],
  [ROUTES.PENGAJUAN_DISKON]: ['Administrator', 'Manager', 'Direktur Utama', 'Admin Salesman', 'Salesman', 'Staff Admin Salesman'],
  [ROUTES.LAPORAN_PENJUALAN]: ['Administrator', 'Manager', 'Direktur Utama', 'Kepala Gudang', 'Admin Salesman'],

  // API endpoints RBAC
  '/api/users': ['Administrator'],
  '/api/logs': ['Administrator', 'Manager', 'Direktur Utama'],
  '/api/keuangan': ['Administrator', 'Manager', 'Direktur Utama', 'Kepala Gudang'],
  '/api/biaya-operasional': ['Administrator', 'Manager', 'Direktur Utama'],
  '/api/target-komisi': ['Administrator', 'Manager', 'Direktur Utama', 'Admin Salesman'],
  '/api/laporan/penjualan': ['Administrator', 'Manager', 'Direktur Utama', 'Kepala Gudang', 'Admin Salesman'],
};

export default auth((req: any) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isApiRoute = pathname.startsWith('/api/');

  // Izinkan route publik dan api internal NextAuth
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Redirect atau response 401 bila belum authenticated
  if (!session) {
    if (isApiRoute) {
      return NextResponse.json(
        { success: false, message: 'Autentikasi diperlukan. Sesi tidak ditemukan.' },
        { status: 401 }
      );
    }
    const loginUrl = new URL(ROUTES.LOGIN, req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cek otorisasi role (prefix matching untuk nested route)
  const userRole = (session.user as any)?.role;
  const matchedRoute = Object.keys(ROUTE_ROLES).find(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
  const allowedRoles = matchedRoute ? ROUTE_ROLES[matchedRoute] : null;

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    if (isApiRoute) {
      return NextResponse.json(
        {
          success: false,
          message: `Akses ditolak. Role '${userRole}' tidak diizinkan mengakses resource ini.`,
        },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL(ROUTES.DASHBOARD, req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/public|api/auth).*)'],
};
