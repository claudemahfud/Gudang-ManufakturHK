'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/router/routes';
import type { UserRole } from '@/shared/types';

// ============================================================
// SHARED COMPONENT: Sidebar
// Dipakai oleh semua halaman dalam layout (dashboard)
// ============================================================

interface NavItem {
  label: string;
  icon: string;
  href: string;
  roles?: UserRole[]; // kosong = semua role
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Utama',
    items: [
      { label: 'Dashboard', icon: '📊', href: ROUTES.DASHBOARD },
      { label: 'Inventory', icon: '📦', href: ROUTES.INVENTORY },
    ],
  },
  {
    group: 'Gudang',
    items: [
      { label: 'Barang Masuk', icon: '📥', href: ROUTES.BARANG_MASUK },
      { label: 'Barang Keluar', icon: '📤', href: ROUTES.BARANG_KELUAR },
      { label: 'Barang Rusak', icon: '❌', href: ROUTES.BARANG_RUSAK },
      { label: 'Mutasi Barang', icon: '🔄', href: ROUTES.MUTASI_BARANG },
      { label: 'Stok Kritis', icon: '⚠️', href: ROUTES.STOK_KRITIS },
    ],
  },
  {
    group: 'Dokumen',
    items: [
      { label: 'Surat Jalan', icon: '🚚', href: ROUTES.SURAT_JALAN },
      { label: 'PO Loading', icon: '📋', href: ROUTES.PO_LOADING },
      { label: 'Retur Barang', icon: '↩️', href: ROUTES.RETUR_BARANG },
    ],
  },
  {
    group: 'Keuangan',
    items: [
      { label: 'Keuangan', icon: '💰', href: ROUTES.KEUANGAN, roles: ['Administrator', 'Manager', 'Direktur Utama', 'Kepala Gudang'] },
      { label: 'Biaya Operasional', icon: '💸', href: ROUTES.BIAYA_OPERASIONAL, roles: ['Administrator', 'Manager', 'Direktur Utama'] },
    ],
  },
  {
    group: 'Salesman & Agen',
    items: [
      { label: 'Pengajuan Diskon', icon: '🏷️', href: ROUTES.PENGAJUAN_DISKON },
      { label: 'Monitor Salesman', icon: '👁️', href: ROUTES.MONITOR_SALESMAN },
      { label: 'Target Komisi', icon: '🎯', href: ROUTES.TARGET_KOMISI },
    ],
  },
  {
    group: 'Operasional',
    items: [
      { label: 'Expedisi', icon: '🚛', href: ROUTES.EXPEDISI },
      { label: 'Kontak', icon: '📞', href: ROUTES.KONTAK },
    ],
  },
  {
    group: 'Admin',
    items: [
      { label: 'Pengguna', icon: '👥', href: ROUTES.USERS, roles: ['Administrator'] },
      { label: 'Log Aktivitas', icon: '📝', href: ROUTES.LOGS, roles: ['Administrator', 'Manager', 'Direktur Utama'] },
    ],
  },
];

interface SidebarProps {
  userRole?: UserRole;
  onClose?: () => void;
}

export default function Sidebar({ userRole, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col h-full bg-white border-r border-gray-100 w-[280px]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <span className="text-2xl">🏭</span>
        <div>
          <div className="font-bold text-gray-800 text-sm leading-tight">Gudang Manufaktur</div>
          <div className="text-xs text-gray-400">Sistem Inventory</div>
        </div>
        {/* Close button (mobile) */}
        {onClose && (
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 lg:hidden">✕</button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_GROUPS.map((group) => {
          // Filter berdasarkan role
          const visibleItems = group.items.filter(
            (item) => !item.roles || !userRole || item.roles.includes(userRole)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.group} className="mb-3">
              <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                {group.group}
              </div>
              {visibleItems.map((item) => {
                const isActive = pathname === item.href || (pathname ? pathname.startsWith(item.href + '/') : false);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                      isActive
                        ? 'bg-green-50 text-green-700 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                    {isActive && <span className="ml-auto w-1.5 h-1.5 bg-green-500 rounded-full" />}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
