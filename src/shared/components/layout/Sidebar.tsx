'use client';

// ============================================================
// SHARED COMPONENT: Sidebar Bertingkat Dropdown (Multi-Domain)
// Mode: Manufaktur vs Food & Beverages (Terisolasi)
// Menu > klik > Dropdown Sub-menu
// ============================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ROUTES } from '@/router/routes';
import type { UserRole } from '@/shared/types';
import { useDivision, DivisionMode } from '@/shared/context/DivisionContext';
import {
  LayoutDashboard,
  HandCoins,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
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
  Coins,
  Scale,
  ChevronDown,
  X,
  ExternalLink,
  Factory,
  Coffee,
  Building2,
  ChefHat,
  CookingPot,
  Store,
  MonitorDot,
  LogOut,
} from 'lucide-react';

interface SubMenuItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
  newTab?: boolean;
  division?: DivisionMode; // Filter khusus mode tertentu jika diisi
}

interface ParentMenuItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
  href?: string;
  items?: SubMenuItem[];
  division?: DivisionMode;
}

export const MENU_HIERARCHY: ParentMenuItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: ROUTES.DASHBOARD,
  },
  {
    id: 'penjualan',
    title: 'Penjualan & Kasir',
    icon: ShoppingBag,
    items: [
      {
        label: 'Kasir POS (Fullscreen)',
        icon: ShoppingBag,
        href: ROUTES.POS,
        newTab: true,
      },
      {
        label: 'Cash Opname Laci',
        icon: Coins,
        href: ROUTES.CASH_OPNAME,
        division: 'FNB', // Khusus F&B
      },
      {
        label: 'Laporan Penjualan & Laba',
        icon: TrendingUp,
        href: ROUTES.LAPORAN_PENJUALAN,
        roles: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Finance & Accounting'],
      },
      {
        label: 'Produk Detile Terjual',
        icon: BarChart3,
        href: ROUTES.PRODUK_TERJUAL,
      },
      {
        label: 'Laporan Rusak & Retur',
        icon: ShieldAlert,
        href: ROUTES.LAPORAN_RUSAK_RETUR,
      },
    ],
  },
  {
    id: 'gudang',
    title: 'Gudang & Inventory',
    icon: Package,
    items: [
      {
        label: 'Master Inventory',
        icon: Package,
        href: ROUTES.INVENTORY,
      },
      {
        label: 'Daftar Suplier',
        icon: Factory,
        href: ROUTES.SUPLIER,
      },
      {
        label: 'Barang Masuk',
        icon: ArrowDownToLine,
        href: ROUTES.BARANG_MASUK,
      },
      {
        label: 'Barang Keluar',
        icon: ArrowUpFromLine,
        href: ROUTES.BARANG_KELUAR,
      },
      {
        label: 'Mutasi Barang',
        icon: ArrowLeftRight,
        href: ROUTES.MUTASI_BARANG,
      },
      {
        label: 'Stok Kritis',
        icon: AlertTriangle,
        href: ROUTES.STOK_KRITIS,
      },
    ],
  },
  {
    id: 'dapur',
    title: 'Dapur Pusat & Franchise',
    icon: ChefHat,
    division: 'FNB', // Khusus F&B
    items: [
      {
        label: 'Master Resep & HPP',
        icon: ChefHat,
        href: ROUTES.KALKULATOR_HPP,
        roles: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Kepala Gudang'],
      },
      {
        label: 'Produksi Dapur',
        icon: CookingPot,
        href: ROUTES.PRODUKSI_DAPUR,
        roles: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Kepala Gudang'],
      },
      {
        label: 'Order Franchise',
        icon: Store,
        href: ROUTES.ORDER_FRANCHISE,
      },
      {
        label: 'Monitor Franchise',
        icon: MonitorDot,
        href: ROUTES.MONITOR_FRANCHISE,
        roles: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Finance & Accounting'],
      },
    ],
  },
  {
    id: 'dokumen',
    title: 'Dokumen Logistik',
    icon: Truck,
    division: 'MANUFAKTUR', // Khusus Manufaktur
    items: [
      {
        label: 'Surat Jalan',
        icon: Truck,
        href: ROUTES.SURAT_JALAN,
      },
      {
        label: 'PO Loading',
        icon: ClipboardList,
        href: ROUTES.PO_LOADING,
      },
      {
        label: 'Retur Barang',
        icon: RotateCcw,
        href: ROUTES.RETUR_BARANG,
      },
    ],
  },
  {
    id: 'keuangan',
    title: 'Keuangan & Neraca',
    icon: Wallet,
    roles: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Finance & Accounting'],
    items: [
      {
        label: 'Arus Kas Keuangan',
        icon: Wallet,
        href: ROUTES.KEUANGAN,
        roles: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Finance & Accounting'],
      },
      {
        label: 'Piutang Pelanggan',
        icon: HandCoins,
        href: ROUTES.PIUTANG,
        roles: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Finance & Accounting'],
      },
      {
        label: 'Neraca Posisi Keuangan',
        icon: Scale,
        href: ROUTES.NERACA,
        roles: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Finance & Accounting'],
      },
      {
        label: 'Biaya Operasional',
        icon: Receipt,
        href: ROUTES.BIAYA_OPERASIONAL,
        roles: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Finance & Accounting'],
      },
    ],
  },
  {
    id: 'salesman',
    title: 'Salesman & Agen',
    icon: LineChart,
    division: 'MANUFAKTUR', // Khusus Manufaktur
    items: [
      {
        label: 'Pengajuan Diskon',
        icon: Tag,
        href: ROUTES.PENGAJUAN_DISKON,
      },
      {
        label: 'Monitor Salesman',
        icon: LineChart,
        href: ROUTES.MONITOR_SALESMAN,
        roles: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Admin Salesman'],
      },
      {
        label: 'Target Komisi',
        icon: Target,
        href: ROUTES.TARGET_KOMISI,
        roles: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama', 'Admin Salesman', 'Salesman', 'Sales Canvas', 'Sales Motoris'],
      },
    ],
  },
  {
    id: 'operasional',
    title: 'Operasional & Mitra',
    icon: Car,
    items: [
      {
        label: 'Armada Ekspedisi',
        icon: Car,
        href: ROUTES.EXPEDISI,
        division: 'MANUFAKTUR',
      },
      {
        label: 'Buku Kontak Mitra',
        icon: BookUser,
        href: ROUTES.KONTAK,
      },
    ],
  },
  {
    id: 'admin',
    title: 'Pengaturan & Admin',
    icon: Users,
    roles: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama'],
    items: [
      {
        label: 'Manajemen Pengguna',
        icon: Users,
        href: ROUTES.USERS,
        roles: ['Administrator'],
      },
      {
        label: 'Pengaturan Perusahaan',
        icon: ShieldAlert,
        href: ROUTES.PENGATURAN_PERUSAHAAN,
        roles: ['Direktur Utama'],
      },
      {
        label: 'Manajemen Cabang',
        icon: Building2,
        href: ROUTES.CABANG,
        roles: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama'],
      },
      {
        label: 'Log Audit Aktivitas',
        icon: History,
        href: ROUTES.LOGS,
        roles: ['Administrator', 'Manager', 'Manager Umum', 'Direktur Utama'],
      },
    ],
  },
];

interface SidebarProps {
  userRole?: UserRole;
  onClose?: () => void;
}

export default function Sidebar({ userRole, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    division,
    isManufaktur,
    isFnb,
    cabang,
    isCabangLocked,
  } = useDivision();

  // State dropdown terbuka (id menu -> boolean)
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    penjualan: true,
    gudang: false,
    dokumen: false,
    keuangan: false,
    salesman: false,
    operasional: false,
    admin: false,
  });

  // Otomatis buka dropdown jika URL saat ini ada di dalam sub-menunya
  useEffect(() => {
    MENU_HIERARCHY.forEach((parent) => {
      if (parent.items) {
        const isChildActive = parent.items.some(
          (sub) => pathname === sub.href || pathname.startsWith(sub.href + '/')
        );
        if (isChildActive) {
          setOpenMenus((prev) => ({ ...prev, [parent.id]: true }));
        }
      }
    });
  }, [pathname]);

  const toggleMenu = (id: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <aside className="flex flex-col h-full bg-white border-r border-gray-200 w-[280px] select-none">
      {/* Brand Header (Dual Line: Title + Subtitle) */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center text-white shadow-sm flex-shrink-0">
          <Boxes className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="truncate">
          <div className="font-bold text-slate-900 text-sm tracking-tight leading-tight truncate">
            {isManufaktur ? 'Gudang Manufaktur' : 'SRasa F&B Hub'}
          </div>
          <div className="text-xs font-medium text-slate-600 truncate mt-0.5">
            {isManufaktur ? 'Sistem Inventory & Distribusi' : 'Sistem Cafe, Resto & Resep'}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto text-slate-400 hover:text-slate-700 lg:hidden p-1 rounded-lg"
            aria-label="Tutup Sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Mode Status & Cabang Info Card (Read-Only di Sidebar) */}
      <div className="p-3 border-b border-gray-100 bg-gray-50/70 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Domain Operasional
          </span>
          <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.5 rounded-md">
            Aktif
          </span>
        </div>

        <div
          className={`flex items-center justify-between p-2.5 rounded-xl border ${
            isManufaktur
              ? 'bg-blue-50/80 border-blue-200 text-blue-900'
              : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                isManufaktur ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              {isManufaktur ? <Factory className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
            </div>
            {/* Dual Line in Badge */}
            <div>
              <div className="text-xs font-bold leading-tight">
                {isManufaktur ? 'Divisi Manufaktur' : 'Divisi F&B'}
              </div>
              <div className="text-[10px] text-slate-600 font-medium">
                {isManufaktur ? 'Pabrik & Distribusi' : 'Cafe, Resto & Bakery'}
              </div>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
        </div>

        {/* Cabang Aktif Info */}
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-white rounded-lg border border-gray-200/70 text-[11px] text-gray-700 shadow-2xs">
          <div className="flex items-center gap-1.5 truncate">
            <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="truncate font-semibold">{cabang}</span>
          </div>
          {isCabangLocked && (
            <span className="text-[9px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded flex-shrink-0 ml-1">
              Terkunci
            </span>
          )}
        </div>
      </div>

      {/* Navigation Tree (Accordion Dropdown) */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {MENU_HIERARCHY.map((parent) => {
          // Otorisasi role parent
          if (parent.roles && userRole && !parent.roles.includes(userRole)) {
            return null;
          }

          // Filter divisi parent
          if (parent.division && parent.division !== division) {
            return null;
          }

          const ParentIcon = parent.icon;

          // 1. Menu Tunggal (Tanpa Sub-menu, misal: Dashboard)
          if (!parent.items || parent.items.length === 0) {
            const isActive = pathname === parent.href;
            return (
              <Link
                key={parent.id}
                href={parent.href || '#'}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all mb-1 ${
                  isActive
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-900'
                }`}
              >
                <ParentIcon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                <span>{parent.title}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                )}
              </Link>
            );
          }

          // Filter sub-items berdasarkan role & divisi
          const visibleSubItems = parent.items.filter((sub) => {
            if (sub.roles && userRole && !sub.roles.includes(userRole)) return false;
            if (sub.division && sub.division !== division) return false;
            return true;
          });

          if (visibleSubItems.length === 0) return null;

          const isParentOpen = !!openMenus[parent.id];
          const hasActiveChild = visibleSubItems.some(
            (sub) => pathname === sub.href || pathname.startsWith(sub.href + '/')
          );

          return (
            <div key={parent.id} className="mb-1">
              {/* Parent Toggle Button */}
              <button
                type="button"
                onClick={() => toggleMenu(parent.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  hasActiveChild
                    ? 'text-gray-900 bg-gray-50 font-bold'
                    : 'text-gray-600 hover:bg-gray-100/70 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ParentIcon
                    className={`w-4 h-4 transition-colors ${
                      hasActiveChild ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  />
                  <span>{parent.title}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 font-mono font-medium px-1.5 py-0.2 rounded-md bg-gray-100">
                    {visibleSubItems.length}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                      isParentOpen ? 'rotate-180 text-gray-700' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Dropdown Sub-menu Container */}
              {isParentOpen && (
                <div className="mt-1 ml-4 pl-3 border-l-2 border-gray-100 space-y-0.5 animate-in fade-in duration-200">
                  {visibleSubItems.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive =
                      pathname === sub.href || pathname.startsWith(sub.href + '/');

                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        target={sub.newTab ? '_blank' : undefined}
                        rel={sub.newTab ? 'noopener noreferrer' : undefined}
                        onClick={onClose}
                        className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          isSubActive
                            ? 'bg-gray-900 text-white font-semibold shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {SubIcon ? (
                            <SubIcon
                              className={`w-3.5 h-3.5 flex-shrink-0 ${
                                isSubActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-700'
                              }`}
                            />
                          ) : (
                            <span
                              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                isSubActive ? 'bg-white' : 'bg-gray-300'
                              }`}
                            />
                          )}
                          <span className="truncate">{sub.label}</span>
                        </div>

                        {sub.newTab ? (
                          <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-gray-700 ml-1 flex-shrink-0" />
                        ) : isSubActive ? (
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0 ml-1" />
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-gray-100 bg-gray-50/50 text-[10px] text-gray-400 text-center">
        <span>Gudang Manufaktur & F&B Hub &bull; v2.2</span>
      </div>
    </aside>
  );
}
