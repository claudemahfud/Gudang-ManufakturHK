import type { UserRole } from '@/shared/types';
import { auth } from './config';
import { NextResponse } from 'next/server';

// ============================================================
// RBAC: Role-Based Access Control Definitions & Helpers
// ============================================================

export const ROLES_ADMIN: UserRole[] = ['Administrator'];

export const ROLES_EXECUTIVE: UserRole[] = [
  'Administrator',
  'Direktur Utama',
  'Manager',
];

export const ROLES_FINANCE: UserRole[] = [
  'Administrator',
  'Direktur Utama',
  'Manager',
  'Kepala Gudang',
];

export const ROLES_WAREHOUSE: UserRole[] = [
  'Administrator',
  'Direktur Utama',
  'Manager',
  'Kepala Gudang',
  'Wakil Gudang',
  'Staff Gudang',
];

export const ROLES_SALES_OPS: UserRole[] = [
  'Administrator',
  'Direktur Utama',
  'Manager',
  'Admin Salesman',
  'Staff Admin Salesman',
  'Salesman',
  'Agen',
  'Admin Agen',
  'Staff Admin Agen',
];

export const ROLES_EXPEDISI: UserRole[] = [
  'Administrator',
  'Direktur Utama',
  'Manager',
  'Kepala Gudang',
  'Kepala Expedisi',
  'Staff Expedisi',
];

/**
 * Validasi otorisasi sesi dan role pada API Route Handler.
 * Mengembalikan objek Session atau NextResponse (401/403) jika tidak berhak.
 */
export async function requireAuthRole(allowedRoles?: UserRole[]) {
  const session = await auth();

  if (!session || !session.user) {
    return {
      authorized: false as const,
      response: NextResponse.json(
        { success: false, message: 'Autentikasi diperlukan. Silakan login kembali.' },
        { status: 401 }
      ),
    };
  }

  const user = session.user as any;
  const userRole = user.role as UserRole;

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(userRole)) {
      return {
        authorized: false as const,
        response: NextResponse.json(
          {
            success: false,
            message: `Akses ditolak. Role '${userRole}' tidak memiliki izin untuk tindakan ini.`,
          },
          { status: 403 }
        ),
      };
    }
  }

  return {
    authorized: true as const,
    session,
    user,
    userRole,
  };
}
