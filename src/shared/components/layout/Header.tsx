'use client';

import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import Link from 'next/link';
import {
  Menu,
  Bell,
  ChevronDown,
  LogOut,
  Factory,
  Coffee,
  Building2,
  Check,
  MapPin,
  ArrowLeftRight,
  Compass,
  Grid,
  User as UserIcon,
  Settings,
} from 'lucide-react';
import { useDivision } from '@/shared/context/DivisionContext';
import { ROUTES } from '@/router/routes';
import CreativeMegaMenu from './CreativeMegaMenu';

// ============================================================
// SHARED COMPONENT: Header
// - Mode Operasional: READ-ONLY (Ganti Mode Wajib Logout Dulu!)
// - Cabang: Boleh Ganti Langsung di Dalam Apps
// ============================================================

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export default function Header({ onMenuClick, title }: HeaderProps) {
  const { data: session } = useSession();
  const {
    isManufaktur,
    isFnb,
    cabang,
    setCabang,
    availableCabang,
    canSwitchDivision,
    canSwitchCabang,
    isCabangLocked,
    logoutAndSwitchMode,
  } = useDivision();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCabangMenu, setShowCabangMenu] = useState(false);
  const [showMegaMenu, setShowMegaMenu] = useState(false);
  const user = session?.user as any;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 gap-3 sticky top-0 z-30 select-none">
      {/* Tombol garis 3: buka/tutup sidebar (desktop & mobile) */}
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Buka/tutup sidebar"
        title="Buka/tutup sidebar"
        className="p-2 rounded-xl hover:bg-gray-100 text-gray-700 transition"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* 1. Mode Operasional Badge (Read-only, Ganti Mode Wajib Logout Dulu) */}
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm ${
          isManufaktur
            ? 'bg-blue-50 border-blue-200 text-blue-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-950'
        }`}
        title="Mode Operasional Sesi Ini (Ganti Mode Wajib Logout Dulu)"
      >
        {isManufaktur ? (
          <Factory className="w-3.5 h-3.5 text-blue-600" />
        ) : (
          <Coffee className="w-3.5 h-3.5 text-emerald-600" />
        )}
        <span className="hidden sm:inline font-bold">
          {isManufaktur ? 'Mode: Manufaktur' : 'Mode: Food & Beverages'}
        </span>
        <span className="sm:hidden font-bold">
          {isManufaktur ? 'Manufaktur' : 'F&B'}
        </span>
      </div>

      {/* 2. Cabang Operasional */}
      <div className="relative">
        {canSwitchCabang ? (
          <button
            onClick={() => setShowCabangMenu((p) => !p)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-semibold shadow-sm transition"
            title="Klik untuk berpindah Cabang / Lokasi Operasional"
          >
            <Building2 className="w-3.5 h-3.5 text-gray-500" />
            <span className="truncate max-w-[140px] sm:max-w-none">{cabang}</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
        ) : (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50/80 text-gray-700 text-xs font-semibold shadow-sm"
            title={isCabangLocked ? `Akses Cabang Terkunci: ${cabang}` : `Lokasi Operasional: ${cabang}`}
          >
            <Building2 className="w-3.5 h-3.5 text-gray-500" />
            <span className="truncate max-w-[140px] sm:max-w-none">{cabang}</span>
            {isCabangLocked && (
              <span className="text-[9px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded">
                Terkunci
              </span>
            )}
          </div>
        )}

        {/* Dropdown Ganti Cabang (Hanya jika canSwitchCabang) */}
        {canSwitchCabang && showCabangMenu && (
          <div className="absolute left-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 mb-1">
              <MapPin className="w-3 h-3" />
              <span>Ganti Lokasi Cabang</span>
            </div>

            <div className="space-y-0.5">
              {availableCabang.map((c) => {
                const isActive = cabang === c;
                return (
                  <button
                    key={c}
                    onClick={() => {
                      setCabang(c);
                      setShowCabangMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition ${
                      isActive
                        ? 'bg-gray-900 text-white font-semibold shadow-sm'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span>{c}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400 px-2 text-center">
              Perpindahan cabang langsung sinkron di dalam aplikasi
            </div>
          </div>
        )}
      </div>

      {/* 3. Creative Mega Menu Quick Access (Image 1 Referensi) */}
      <button
        onClick={() => setShowMegaMenu(true)}
        className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold shadow-sm transition group"
        title="Buka Navigasi Mega Menu Cepat (Semua Modul)"
      >
        <Grid className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-600 transition" />
        <span>Jelajah Modul</span>
        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white border border-slate-200 text-slate-500 font-medium">
          Mega Menu
        </span>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notifications */}
      <button className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition">
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
      </button>

      {/* User avatar + dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowUserMenu((p) => !p)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition"
        >
          <div className="w-8 h-8 bg-gray-900 text-white rounded-lg flex items-center justify-center font-bold text-xs tracking-wider">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="hidden sm:block text-left">
            {/* Dual Line: Name & Role */}
            <div className="text-xs font-bold text-slate-900 leading-tight">{user?.name}</div>
            <div className="text-[11px] text-slate-600 font-medium leading-none mt-0.5">{user?.role}</div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        </button>

        {/* Dropdown User: Setting Akun & Ganti Mode (Permintaan Khusus User) */}
        {showUserMenu && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
            {/* 1. Header Profile (Triple Line: Nama, Role, Mode) */}
            <div className="px-4 py-3 border-b border-gray-100 space-y-0.5">
              <div className="text-xs font-extrabold text-slate-950 leading-tight">{user?.name}</div>
              <div className="text-[11px] font-semibold text-slate-600 leading-none">{user?.role}</div>
              <div className="text-[11px] text-slate-500 pt-0.5">
                Mode: <strong className="text-slate-900">{isManufaktur ? 'Manufaktur' : 'Food & Beverages'}</strong>
              </div>
            </div>

            <div className="py-1">
              {/* 2. Menu Item 1: Setting Akun / Profil */}
              <Link
                href={ROUTES.PROFILE}
                onClick={() => setShowUserMenu(false)}
                className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition group text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-slate-900 text-slate-600 group-hover:text-white flex items-center justify-center shrink-0 transition mt-0.5">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
                {/* List Dual-Line */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900 group-hover:text-slate-950 leading-tight">
                    Setting Akun & Profil
                  </div>
                  <div className="text-[10px] text-slate-500 leading-normal mt-0.5">
                    Edit identitas & ganti kata sandi
                  </div>
                </div>
              </Link>

              {/* 3. Menu Item 2: Ganti Mode Operasional */}
              {canSwitchDivision ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    logoutAndSwitchMode();
                  }}
                  className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-blue-50/70 transition group text-left"
                  title="Ganti mode operasional wajib logout terlebih dahulu"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white flex items-center justify-center shrink-0 transition mt-0.5">
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </div>
                  {/* List Dual-Line */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-blue-700 group-hover:text-blue-800 leading-tight">
                      Ganti Mode Operasional
                    </div>
                    <div className="text-[10px] text-blue-600/80 leading-normal mt-0.5">
                      Logout & pilih Manufaktur / F&B
                    </div>
                  </div>
                </button>
              ) : (
                <div className="px-4 py-2 flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  <span>Mode Terkunci: {isManufaktur ? 'Manufaktur' : 'F&B'}</span>
                </div>
              )}
            </div>

            {/* 4. Menu Item 3: Keluar (Logout) */}
            <div className="pt-1 border-t border-gray-100">
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar (Logout)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {(showUserMenu || showCabangMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowUserMenu(false);
            setShowCabangMenu(false);
          }}
        />
      )}

      {/* Creative Mega Menu Modal Layer */}
      <CreativeMegaMenu
        isOpen={showMegaMenu}
        onClose={() => setShowMegaMenu(false)}
        userRole={user?.role}
      />
    </header>
  );
}
