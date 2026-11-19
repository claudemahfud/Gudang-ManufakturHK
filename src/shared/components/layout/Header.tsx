'use client';

import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Menu,
  Bell,
  ChevronDown,
  LogOut,
  Factory,
  Coffee,
  ArrowLeftRight,
  Sparkles,
} from 'lucide-react';
import { useDivision, DivisionMode } from '@/shared/context/DivisionContext';
import { ROUTES } from '@/router/routes';

// ============================================================
// SHARED COMPONENT: Header dengan Mode Switcher (Manufaktur / F&B)
// ============================================================

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export default function Header({ onMenuClick, title }: HeaderProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { division, setDivision, isManufaktur, isFnb } = useDivision();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);
  const user = session?.user as any;

  const handleSwitchDivision = (newMode: DivisionMode) => {
    setDivision(newMode);
    setShowSwitchMenu(false);
    router.refresh();
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 gap-3 sticky top-0 z-30 select-none">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-700 transition"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Brand & Division Selector Pill */}
      <div className="relative">
        <button
          onClick={() => setShowSwitchMenu((p) => !p)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-semibold shadow-sm ${
            isManufaktur
              ? 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950 hover:bg-emerald-100'
          }`}
          title="Klik untuk beralih mode divisi operasional"
        >
          {isManufaktur ? (
            <Factory className="w-3.5 h-3.5 text-blue-600" />
          ) : (
            <Coffee className="w-3.5 h-3.5 text-emerald-600" />
          )}
          <span>{isManufaktur ? 'Mode: Manufaktur' : 'Mode: Food & Beverages'}</span>
          <ChevronDown className="w-3 h-3 text-gray-500" />
        </button>

        {/* Dropdown Ganti Mode Operasional */}
        {showSwitchMenu && (
          <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1">
              Ganti Jalur Operasional
            </div>

            <button
              onClick={() => handleSwitchDivision('MANUFAKTUR')}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                isManufaktur
                  ? 'bg-blue-50/80 text-blue-900 font-bold border border-blue-200/60'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                <Factory className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="text-xs">Divisi Manufaktur</div>
                <div className="text-[10px] text-gray-400 font-normal">Gudang pabrik, bal & POS grosir</div>
              </div>
            </button>

            <button
              onClick={() => handleSwitchDivision('FNB')}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all mt-1 ${
                isFnb
                  ? 'bg-emerald-50/80 text-emerald-950 font-bold border border-emerald-200/60'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <Coffee className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="text-xs">Divisi Food & Beverages</div>
                <div className="text-[10px] text-gray-400 font-normal">Bahan baku, resep BOM & POS cafe</div>
              </div>
            </button>

            <div className="mt-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowSwitchMenu(false);
                  router.push(ROUTES.SELECT_MODE);
                }}
                className="w-full flex items-center justify-center gap-2 py-1.5 text-[11px] font-medium text-gray-500 hover:text-gray-900"
              >
                <ArrowLeftRight className="w-3 h-3" />
                Buka Layar Pilih Mode Penuh
              </button>
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

        {/* Dropdown */}
        {showUserMenu && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <div className="text-xs font-semibold text-gray-800">{user?.name}</div>
              <div className="text-[10px] text-gray-400">{user?.role}</div>
            </div>

            <button
              onClick={() => {
                setShowUserMenu(false);
                router.push(ROUTES.SELECT_MODE);
              }}
              className="w-full flex items-center gap-2 text-left px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-gray-400" />
              Ganti Jalur Mode
            </button>

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-2 text-left px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition border-t border-gray-100"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </div>
        )}
      </div>

      {(showUserMenu || showSwitchMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowUserMenu(false);
            setShowSwitchMenu(false);
          }}
        />
      )}
    </header>
  );
}
