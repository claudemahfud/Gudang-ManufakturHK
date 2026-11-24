import NextAuth from 'next-auth';
import { authConfig } from '@/shared/lib/auth/auth.config';
import { NextResponse } from 'next/server';
import { ROUTES } from '@/router/routes';
import { punyaRole } from '@/shared/lib/auth/roles';

// ============================================================
// MIDDLEWARE — Edge-compatible Auth Guard + Role Based
// ============================================================

const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = [ROUTES.LOGIN, ROUTES.FORGOT_PASSWORD, '/api/public'];

// Pembukuan: hanya Direktur Utama & Manager (sama dengan ROLES_PEMBUKUAN di rbac.ts)
const PEMBUKUAN = ['Direktur Utama', 'Manager', 'Manager Umum'];

const ROUTE_ROLES: Record<string, string[]> = {
  // Page routes
  [ROUTES.USERS]: ['Administrator', 'Direktur Utama'], // Direktur: atur multi-role (API dijaga terpisah)
  [ROUTES.PENGATURAN_PERUSAHAAN]: ['Direktur Utama', 'Administrator'], // Administrator: hanya Zona Bahaya (Reset Total)
  [ROUTES.LOGS]: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama'],
  [ROUTES.KEUANGAN]: PEMBUKUAN,
  [ROUTES.BIAYA_OPERASIONAL]: PEMBUKUAN,
  [ROUTES.NERACA]: PEMBUKUAN,
  '/laporan-keuangan': PEMBUKUAN,
  '/jurnal': PEMBUKUAN,
  '/hutang': PEMBUKUAN,
  [ROUTES.PIUTANG]: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Finance & Accounting'],
  [ROUTES.MONITOR_FRANCHISE]: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Finance & Accounting'],
  [ROUTES.PRODUKSI_DAPUR]: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Kepala Gudang'],
  [ROUTES.TARGET_KOMISI]: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Admin Salesman'],
  [ROUTES.MONITOR_SALESMAN]: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Admin Salesman'],
  [ROUTES.PENGAJUAN_DISKON]: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Admin Salesman', 'Salesman', 'Sales Canvas', 'Sales Motoris', 'Staff Admin Salesman'],
  [ROUTES.LAPORAN_PENJUALAN]: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Kepala Gudang', 'Admin Salesman', 'Finance & Accounting'],

  // API endpoints RBAC
  // Direktur: GET daftar & PUT roles. Tiap handler menjaga role-nya sendiri (POST/PUT/DELETE/password = Administrator)
  '/api/users': ['Administrator', 'Direktur Utama'],
  '/api/logs': ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama'],
  '/api/keuangan': PEMBUKUAN,
  '/api/biaya-operasional': PEMBUKUAN,
  '/api/akuntansi': PEMBUKUAN,
  '/api/hutang': PEMBUKUAN,
  '/api/piutang': ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Finance & Accounting'],
  '/api/franchise/monitor': ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Finance & Accounting'],
  '/api/target-komisi': ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Admin Salesman'],
  '/api/laporan/penjualan': ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Kepala Gudang', 'Admin Salesman', 'Finance & Accounting'],
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
  const sesiUser = session.user as { role?: string; roles?: string[] };
  const matchedRoute = Object.keys(ROUTE_ROLES).find(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
  const allowedRoles = matchedRoute ? ROUTE_ROLES[matchedRoute] : null;

  if (allowedRoles && allowedRoles.length > 0 && !punyaRole(sesiUser, allowedRoles)) {
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
