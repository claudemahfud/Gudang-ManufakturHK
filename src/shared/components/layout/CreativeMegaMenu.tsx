'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Grid,
  Package,
  ShoppingBag,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  AlertTriangle,
  Truck,
  Factory,
  ClipboardList,
  RotateCcw,
  Wallet,
  Receipt,
  Scale,
  Calculator,
  Coins,
  TrendingUp,
  BarChart3,
  ShieldAlert,
  Car,
  BookUser,
  Users,
  Building2,
  Tag,
  Target,
  Sparkles,
  ExternalLink,
  ChevronRight,
  X,
  Layers,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { ROUTES } from '@/router/routes';
import { useDivision } from '@/shared/context/DivisionContext';
import type { UserRole } from '@/shared/types';

interface MegaMenuProps {
  userRole?: UserRole;
  isOpen: boolean;
  onClose: () => void;
}

export default function CreativeMegaMenu({ userRole, isOpen, onClose }: MegaMenuProps) {
  const router = useRouter();
  const { division, isManufaktur, isFnb, cabang } = useDivision();
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'ops' | 'stock' | 'finance'>('all');

  // Close on Escape or click outside
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Modul Categories
  const categoryGudang = [
    {
      title: 'Master Inventory',
      desc: 'Katalog SKU, stok fisik & HPP',
      href: ROUTES.INVENTORY,
      icon: Package,
      badge: 'Utama',
    },
    {
      title: 'Daftar Suplier',
      desc: 'Master suplier & status hutang',
      href: ROUTES.SUPLIER,
      icon: Factory,
    },
    {
      title: 'Barang Masuk',
      desc: 'Penerimaan muatan dari supplier',
      href: ROUTES.BARANG_MASUK,
      icon: ArrowDownToLine,
    },
    {
      title: 'Barang Keluar',
      desc: 'Pengeluaran muatan grosir & logistik',
      href: ROUTES.BARANG_KELUAR,
      icon: ArrowUpFromLine,
    },
    {
      title: 'Mutasi Antar Cabang',
      desc: 'Transfer stok antar unit cabang',
      href: ROUTES.MUTASI_BARANG,
      icon: ArrowLeftRight,
    },
    {
      title: 'Stok Kritis',
      desc: 'Peringatan sisa stok di bawah batas aman',
      href: ROUTES.STOK_KRITIS,
      icon: AlertTriangle,
      alert: true,
    },
    ...(isFnb
      ? [
          {
            title: 'Kalkulator HPP & Resep',
            desc: 'BOM resep porsi & food costing',
            href: ROUTES.KALKULATOR_HPP,
            icon: Calculator,
            fnbOnly: true,
          },
        ]
      : []),
  ];

  const categoryKasir = [
    {
      title: 'Kasir POS Fullscreen',
      desc: 'Point of sale cepat tanpa reload',
      href: ROUTES.POS,
      icon: ShoppingBag,
      newTab: true,
      badge: 'Kasir',
    },
    ...(isFnb
      ? [
          {
            title: 'Cash Opname Laci',
            desc: 'Pengecekan fisik uang kas laci',
            href: ROUTES.CASH_OPNAME,
            icon: Coins,
            fnbOnly: true,
          },
        ]
      : []),
    {
      title: 'Laporan Penjualan & Laba',
      desc: 'Analisis omzet, margin & tren sales',
      href: ROUTES.LAPORAN_PENJUALAN,
      icon: TrendingUp,
      restricted: !['Administrator', 'Manager', 'Direktur Utama'].includes(userRole || ''),
    },
    {
      title: 'Produk Detil Terjual',
      desc: 'Rincian kuantitas per varian',
      href: ROUTES.PRODUK_TERJUAL,
      icon: BarChart3,
    },
    {
      title: 'Laporan Rusak & Retur',
      desc: 'Catatan barang cacat & retur pelanggan',
      href: ROUTES.LAPORAN_RUSAK_RETUR,
      icon: ShieldAlert,
    },
  ];

  const categoryLogistik = [
    ...(isManufaktur
      ? [
          {
            title: 'Surat Jalan Muatan',
            desc: 'Dokumen pengiriman resmi dengan driver',
            href: ROUTES.SURAT_JALAN,
            icon: Truck,
          },
          {
            title: 'PO Loading Gudang',
            desc: 'Jadwal muat barang ke armada',
            href: ROUTES.PO_LOADING,
            icon: ClipboardList,
          },
          {
            title: 'Retur Muatan Barang',
            desc: 'Pengembalian barang ke supplier',
            href: ROUTES.RETUR_BARANG,
            icon: RotateCcw,
          },
          {
            title: 'Armada Ekspedisi',
            desc: 'Daftar armada & nomor polisi',
            href: ROUTES.EXPEDISI,
            icon: Car,
          },
        ]
      : []),
    {
      title: 'Buku Kontak Mitra',
      desc: 'Database supplier, vendor & customer',
      href: ROUTES.KONTAK,
      icon: BookUser,
    },
  ];

  const categoryKeuanganAdmin = [
    {
      title: 'Arus Kas Keuangan',
      desc: 'Pencatatan kas masuk dan kas keluar',
      href: ROUTES.KEUANGAN,
      icon: Wallet,
      restricted: !['Administrator', 'Manager', 'Direktur Utama'].includes(userRole || ''),
    },
    {
      title: 'Neraca Keuangan',
      desc: 'Laporan aset, kewajiban & ekuitas',
      href: ROUTES.NERACA,
      icon: Scale,
      restricted: !['Administrator', 'Manager', 'Direktur Utama'].includes(userRole || ''),
    },
    {
      title: 'Biaya Operasional',
      desc: 'Beban operasional harian & bulanan',
      href: ROUTES.BIAYA_OPERASIONAL,
      icon: Receipt,
      restricted: !['Administrator', 'Manager', 'Direktur Utama'].includes(userRole || ''),
    },
    {
      title: 'Setting Profil Akun',
      desc: 'Edit identitas, ganti password & ganti mode',
      href: ROUTES.PROFILE,
      icon: Users,
    },
    {
      title: 'Manajemen Cabang',
      desc: 'Isolasi data & penempatan lokasi cabang',
      href: ROUTES.CABANG,
      icon: Building2,
      restricted: !['Administrator', 'Manager', 'Direktur Utama'].includes(userRole || ''),
    },
    {
      title: 'Manajemen Pengguna',
      desc: 'Hak akses RBAC & proteksi akun bawahan',
      href: ROUTES.USERS,
      icon: Users,
      restricted: userRole !== 'Administrator',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 flex items-start justify-center pt-16 sm:pt-20 px-3 pb-8">
      <nav
        ref={menuRef}
        aria-label="Creative Mega Menu Navigation"
        className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden transform transition-all duration-200 animate-in zoom-in-95"
      >
        {/* Top Header of Mega Menu (Triple Line Archetype & WCAG Compliant) */}
        <header className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-sm shrink-0">
              <Grid className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                  Pusat Navigasi Terpadu
                </span>
                <span className="text-[10px] font-bold text-slate-500">• Akses Cepat 2-3 Klik</span>
              </div>
              <h2 className="text-base font-extrabold text-slate-950 tracking-tight leading-tight">
                Jelajah Seluruh Modul & Fitur Sistem
              </h2>
              <p className="text-xs text-slate-600 leading-normal">
                Akses instan seluruh alur operasional gudang, POS kasir, dokumen logistik, dan laporan keuangan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Cabang Aktif: <strong className="text-slate-900">{cabang}</strong></span>
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 transition"
              title="Tutup Mega Menu (Esc)"
              aria-label="Tutup Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Body: 4-Column Grid + Featured Promo Card (Reference Image 1) */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 max-h-[75vh] overflow-y-auto">
          {/* Column 1: Pergudangan & Stok */}
          <section className="md:col-span-3 space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200">
              <Package className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-extrabold text-slate-950 uppercase tracking-wider">
                Gudang & Stok
              </h3>
            </div>
            <ul className="space-y-1">
              {categoryGudang.map((item) => (
                <li key={item.title}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="group block p-2 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 hover-lift"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition mt-0.5">
                        <item.icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* List Dual-Line: Line 1 Title */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition truncate leading-tight">
                            {item.title}
                          </span>
                          {item.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-md">
                              {item.badge}
                            </span>
                          )}
                          {item.alert && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          )}
                        </div>
                        {/* List Dual-Line: Line 2 Subtitle (WCAG Compliant 4.5:1+) */}
                        <p className="text-[11px] text-slate-600 truncate leading-normal mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Column 2: Penjualan & POS */}
          <section className="md:col-span-3 space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-extrabold text-slate-950 uppercase tracking-wider">
                Penjualan & Kasir
              </h3>
            </div>
            <ul className="space-y-1">
              {categoryKasir.map((item) => (
                <li key={item.title}>
                  <Link
                    href={item.href}
                    target={item.newTab ? '_blank' : undefined}
                    onClick={onClose}
                    className="group block p-2 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 hover-lift"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition mt-0.5">
                        <item.icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* List Dual-Line: Line 1 Title */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition truncate leading-tight">
                            {item.title}
                          </span>
                          {item.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-md">
                              {item.badge}
                            </span>
                          )}
                          {item.newTab && (
                            <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-600" />
                          )}
                        </div>
                        {/* List Dual-Line: Line 2 Subtitle */}
                        <p className="text-[11px] text-slate-600 truncate leading-normal mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Column 3: Logistik & Dokumen */}
          <section className="md:col-span-3 space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200">
              <Truck className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-extrabold text-slate-950 uppercase tracking-wider">
                Logistik & Mitra
              </h3>
            </div>
            <ul className="space-y-1">
              {categoryLogistik.map((item) => (
                <li key={item.title}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="group block p-2 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 hover-lift"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition mt-0.5">
                        <item.icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition truncate leading-tight">
                            {item.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 truncate leading-normal mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
              {/* Tambahan keuangan ringkas jika logistik sedikit */}
              {categoryKeuanganAdmin.slice(0, 2).map((item) => {
                if (item.restricted) return null;
                return (
                  <li key={item.title}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className="group block p-2 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 hover-lift"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition mt-0.5">
                          <item.icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition truncate leading-tight block">
                            {item.title}
                          </span>
                          <p className="text-[11px] text-slate-600 truncate leading-normal mt-0.5">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Column 4: Featured Promo Card (Reference Image 1: Lumen Featured Style) */}
          <aside className="md:col-span-3 flex flex-col justify-between p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-bold text-emerald-300">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>PUSAT AKSI CEPAT</span>
              </div>

              {/* Triple Line: Overline / Title / Subtitle (Clickable to open menu directly) */}
              <Link
                href={ROUTES.POS}
                target="_blank"
                onClick={onClose}
                className="group/title block space-y-1 cursor-pointer hover:opacity-95 transition"
                title="Buka Kasir POS Sekarang"
              >
                <h4 className="text-sm font-extrabold text-white tracking-tight leading-snug group-hover/title:text-emerald-300 transition">
                  {isManufaktur ? 'Divisi Manufaktur & Distribusi' : 'Food & Beverage Hub'}
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Operasional aktif di cabang <strong>{cabang}</strong>. Akses kasir dan kelola stok secara real-time.
                </p>
              </Link>

              <div className="pt-2 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Status Database</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Terhubung & Stabil
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Proteksi RLS</span>
                  <span className="text-white font-mono font-bold">100% Terisolasi</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-5 space-y-2">
              <Link
                href={ROUTES.POS}
                target="_blank"
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 transition active:scale-95"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Buka Kasir POS Sekarang</span>
              </Link>
              <Link
                href={ROUTES.DASHBOARD}
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition"
              >
                <span>Lihat Dashboard Utama</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>
          </aside>
        </div>

        {/* Footer of Mega Menu */}
        <footer className="px-6 py-3 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Multi-cabang otomatis tersinkron</span>
            </span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="hidden sm:inline">Semua aksi terekam di Log Audit</span>
          </div>
          <div className="text-slate-400">
            Gudang Manufaktur & F&B Hub v2.2
          </div>
        </footer>
      </nav>
    </div>
  );
}
