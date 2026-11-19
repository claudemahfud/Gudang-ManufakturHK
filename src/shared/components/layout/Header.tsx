'use client';

import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
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
} from 'lucide-react';
import { useDivision } from '@/shared/context/DivisionContext';
import { ROUTES } from '@/router/routes';

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
    logoutAndSwitchMode,
  } = useDivision();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCabangMenu, setShowCabangMenu] = useState(false);
  const user = session?.user as any;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 gap-3 sticky top-0 z-30 select-none">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-700 transition"
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

      {/* 2. Ganti Cabang (Boleh di Dalam Apps) */}
      <div className="relative">
        <button
          onClick={() => setShowCabangMenu((p) => !p)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-semibold shadow-sm transition"
          title="Klik untuk berpindah Cabang / Lokasi Operasional"
        >
          <Building2 className="w-3.5 h-3.5 text-gray-500" />
          <span className="truncate max-w-[140px] sm:max-w-none">{cabang}</span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>

        {/* Dropdown Ganti Cabang */}
        {showCabangMenu && (
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
            <div className="text-xs font-semibold text-gray-800 leading-tight">{user?.name}</div>
            <div className="text-[10px] text-gray-400 font-medium">{user?.role}</div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>

        {/* Dropdown User */}
        {showUserMenu && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <div className="text-xs font-semibold text-gray-900">{user?.name}</div>
              <div className="text-[10px] text-gray-400">{user?.role}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Mode: <strong className="text-gray-800">{isManufaktur ? 'Manufaktur' : 'Food & Beverages'}</strong>
              </div>
            </div>

            {/* Tombol Ganti Mode (Khusus Pimpinan & Wajib Logout Dulu) */}
            {canSwitchDivision && (
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  logoutAndSwitchMode();
                }}
                className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50 transition"
                title="Ganti Mode operasional wajib logout terlebih dahulu"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
                <span>Logout & Ganti Mode</span>
              </button>
            )}

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition border-t border-gray-100"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar (Logout)</span>
            </button>
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
    </header>
  );
}
