'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/router/routes';
import type { UserRole } from '@/shared/types';
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertOctagon,
  ArrowLeftRight,
  AlertTriangle,
  Truck,
  ClipboardList,
  RotateCcw,
  Wallet,
  Receipt,
  Tag,
  LineChart,
  Target,
  Car,
  BookUser,
  Users,
  History,
  Boxes,
  ShoppingBag,
  TrendingUp,
  BarChart3,
  ShieldAlert,
  X,
} from 'lucide-react';

// ============================================================
// SHARED COMPONENT: Sidebar (Monochrome Professional Icons)
// ============================================================

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  roles?: UserRole[];
  newTab?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Utama',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, href: ROUTES.DASHBOARD },
      { label: 'Inventory', icon: Package, href: ROUTES.INVENTORY },
    ],
  },
  {
    group: 'Penjualan',
    items: [
      { label: 'Kasir POS (Fullscreen)', icon: ShoppingBag, href: ROUTES.POS, newTab: true },
      { label: 'Laporan Penjualan', icon: TrendingUp, href: ROUTES.LAPORAN_PENJUALAN },
      { label: 'Produk Detile Terjual', icon: BarChart3, href: ROUTES.PRODUK_TERJUAL },
      { label: 'Laporan Rusak & Retur', icon: ShieldAlert, href: ROUTES.LAPORAN_RUSAK_RETUR },
    ],
  },
  {
    group: 'Gudang',
    items: [
      { label: 'Barang Masuk', icon: ArrowDownToLine, href: ROUTES.BARANG_MASUK },
      { label: 'Barang Keluar', icon: ArrowUpFromLine, href: ROUTES.BARANG_KELUAR },
      { label: 'Barang Rusak', icon: AlertOctagon, href: ROUTES.BARANG_RUSAK },
      { label: 'Mutasi Barang', icon: ArrowLeftRight, href: ROUTES.MUTASI_BARANG },
      { label: 'Stok Kritis', icon: AlertTriangle, href: ROUTES.STOK_KRITIS },
    ],
  },
  {
    group: 'Dokumen',
    items: [
      { label: 'Surat Jalan', icon: Truck, href: ROUTES.SURAT_JALAN },
      { label: 'PO Loading', icon: ClipboardList, href: ROUTES.PO_LOADING },
      { label: 'Retur Barang', icon: RotateCcw, href: ROUTES.RETUR_BARANG },
    ],
  },
  {
    group: 'Keuangan',
    items: [
      { label: 'Keuangan', icon: Wallet, href: ROUTES.KEUANGAN, roles: ['Administrator', 'Manager', 'Direktur Utama', 'Kepala Gudang'] },
      { label: 'Biaya Operasional', icon: Receipt, href: ROUTES.BIAYA_OPERASIONAL, roles: ['Administrator', 'Manager', 'Direktur Utama'] },
    ],
  },
  {
    group: 'Salesman & Agen',
    items: [
      { label: 'Pengajuan Diskon', icon: Tag, href: ROUTES.PENGAJUAN_DISKON },
      { label: 'Monitor Salesman', icon: LineChart, href: ROUTES.MONITOR_SALESMAN },
      { label: 'Target Komisi', icon: Target, href: ROUTES.TARGET_KOMISI },
    ],
  },
  {
    group: 'Operasional',
    items: [
      { label: 'Expedisi', icon: Car, href: ROUTES.EXPEDISI },
      { label: 'Kontak', icon: BookUser, href: ROUTES.KONTAK },
    ],
  },
  {
    group: 'Admin',
    items: [
      { label: 'Pengguna', icon: Users, href: ROUTES.USERS, roles: ['Administrator'] },
      { label: 'Log Aktivitas', icon: History, href: ROUTES.LOGS, roles: ['Administrator', 'Manager', 'Direktur Utama'] },
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
    <aside className="flex flex-col h-full bg-white border-r border-gray-200 w-[280px]">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center text-white">
          <Boxes className="w-5 h-5" />
        </div>
        <div>
          <div className="font-bold text-gray-900 text-sm tracking-tight leading-tight">Gudang Manufaktur</div>
          <div className="text-[11px] font-medium text-gray-400">Sistem Inventory & Distribusi</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 lg:hidden p-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.roles || !userRole || item.roles.includes(userRole)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.group} className="mb-4">
              <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                {group.group}
              </div>
              {visibleItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    target={item.newTab ? '_blank' : undefined}
                    rel={item.newTab ? 'noopener noreferrer' : undefined}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                      isActive
                        ? 'bg-gray-900 text-white font-semibold shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100/70 hover:text-gray-900'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    <span>{item.label}</span>
                    {isActive && <span className="ml-auto w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
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
