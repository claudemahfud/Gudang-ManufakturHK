import type { UserRole } from '@/shared/types';

// ============================================================
// Multi-role: satu akun punya satu role utama (users.role) dan
// role tambahan (users.roles_tambahan) yang ditetapkan Direktur Utama.
// Hak akses = gabungan semua role. Aman untuk Edge runtime (tanpa DB).
// ============================================================

export const SEMUA_ROLE: UserRole[] = [
  'Administrator',
  'Direktur Utama',
  'Manager',
  'Manager Umum',
  'Finance & Accounting',
  'Kepala Gudang',
  'Wakil Gudang',
  'Staff Gudang',
  'Kepala Expedisi',
  'Staff Expedisi',
  'Salesman',
  'Sales Canvas',
  'Sales Motoris',
  'Admin Salesman',
  'Staff Admin Salesman',
  'Agen',
  'Sales Agent',
  'Admin Agen',
  'Staff Admin Agen',
];

/** Penentu role tambahan. */
export const PENENTU_MULTI_ROLE: UserRole = 'Direktur Utama';

type PembawaRole = { role?: string | null; roles?: readonly string[] | null } | null | undefined;

/** Semua role akun: role utama lebih dulu, lalu role tambahan (tanpa duplikat). */
export function rolesOf(u: PembawaRole): string[] {
  const out = new Set<string>();
  if (u?.role) out.add(u.role);
  for (const r of u?.roles ?? []) if (r) out.add(r);
  return [...out];
}

/** Punya minimal satu role dari daftar. */
export function punyaRole(u: PembawaRole, diizinkan: readonly string[]): boolean {
  return rolesOf(u).some((r) => diizinkan.includes(r));
}

/**
 * Ruang lingkup data (Mode Manufaktur/F&B, cabang, data sendiri) mengikuti ROLE UTAMA saja.
 * Role tambahan hanya menambah menu & fitur di dalam Mode yang sama.
 */
export function roleUtamaDi(u: PembawaRole, daftar: readonly string[]): boolean {
  return Boolean(u?.role && daftar.includes(u.role));
}

/** Label ringkas untuk header/kartu: "Kepala Gudang +2". */
export function labelRole(u: PembawaRole): string {
  const r = rolesOf(u);
  return r.length > 1 ? `${r[0]} +${r.length - 1}` : r[0] ?? '';
}

/** Bersihkan input role tambahan: hanya role sah, tanpa role utama, tanpa duplikat. */
export function rapikanRoleTambahan(input: unknown, roleUtama: string): UserRole[] {
  if (!Array.isArray(input)) return [];
  const sah = new Set<UserRole>();
  for (const r of input) {
    if (typeof r === 'string' && (SEMUA_ROLE as string[]).includes(r) && r !== roleUtama) sah.add(r as UserRole);
  }
  return SEMUA_ROLE.filter((r) => sah.has(r));
}
