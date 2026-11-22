import type { UserRole } from '@/shared/types';
import { auth } from './config';
import { NextResponse } from 'next/server';

// ============================================================
// RBAC: Role-Based Access Control Definitions & Privacy Bounds
// Menjamin privasi data keuangan, laba, dan HPP dari akun bawahan
// ============================================================

export const ROLES_ADMIN: UserRole[] = ['Administrator'];

export const ROLES_EXECUTIVE: UserRole[] = [
  'Administrator',
  'Direktur Utama',
  'Manager',
];

// Keuangan, Neraca & Arus Kas: Khusus pimpinan (Akun bawahan tidak boleh akses)
export const ROLES_FINANCE: UserRole[] = [
  'Administrator',
  'Direktur Utama',
  'Manager',
];

// Laporan Laba Bersih, Margin Profit & HPP: Khusus pimpinan
export const ROLES_PROFIT_MARGIN: UserRole[] = [
  'Administrator',
  'Direktur Utama',
  'Manager',
];

// Manajemen Pengguna & Hak Akses
export const ROLES_USER_MANAGEMENT: UserRole[] = ['Administrator'];

// Log Audit Aktivitas
export const ROLES_AUDIT_LOGS: UserRole[] = [
  'Administrator',
  'Direktur Utama',
];

// Resep & Kalkulator HPP Bahan Baku
export const ROLES_RECIPE_BOM: UserRole[] = [
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

export const ROLES_POS: UserRole[] = [
  'Administrator',
  'Direktur Utama',
  'Manager',
  'Kepala Gudang',
  'Wakil Gudang',
  'Staff Gudang',
  'Salesman',
  'Admin Salesman',
  'Staff Admin Salesman',
  'Agen',
  'Admin Agen',
  'Staff Admin Agen',
];

// Pengeluaran barang (grosir/loading): tim gudang + tim penjualan
export const ROLES_STOCK_OUT: UserRole[] = ROLES_POS;

// Koreksi stok langsung di master inventory (stock opname): pimpinan & kepala gudang
export const ROLES_STOCK_ADJUST: UserRole[] = [
  'Administrator',
  'Direktur Utama',
  'Manager',
  'Kepala Gudang',
];

/**
 * Cek apakah sebuah role berhak melihat Harga Beli / HPP Modal rahasia perusahaan
 */
export function canViewCostPrice(role?: UserRole | string | null): boolean {
  if (!role) return false;
  return ROLES_PROFIT_MARGIN.includes(role as UserRole);
}

/**
 * Validasi otorisasi sesi dan role pada API Route Handler.
 * Mengembalikan objek Session atau NextResponse (401/403) jika tidak berhak.
 */
export async function requireAuthRole(allowedRoles?: UserRole[]) {
  const session = await auth();

  if (!session || !session.user) {
    return {
      authorized: false as const,
      user: null,
      userRole: null,
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
        user,
        userRole,
        response: NextResponse.json(
          {
            success: false,
            message: `Akses ditolak. Role '${userRole}' tidak memiliki izin untuk melihat informasi ini (Privasi Dibatasi).`,
          },
          { status: 403 }
        ),
      };
    }
  }

  return {
    authorized: true as const,
    user,
    userRole,
    response: null,
  };
}
