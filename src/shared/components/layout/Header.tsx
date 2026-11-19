'use client';

import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import { Menu, Bell, ChevronDown, LogOut } from 'lucide-react';

// ============================================================
// SHARED COMPONENT: Header (Monochrome Clean Topbar)
// ============================================================

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export default function Header({ onMenuClick, title }: HeaderProps) {
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const user = session?.user as any;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 gap-4 sticky top-0 z-30">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-700 transition"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Title */}
      {title && (
        <h1 className="text-sm font-semibold text-gray-800 hidden sm:block">{title}</h1>
      )}

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
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <div className="text-xs font-semibold text-gray-800">{user?.name}</div>
              <div className="text-[10px] text-gray-400">{user?.role}</div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </div>
        )}
      </div>

      {showUserMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
      )}
    </header>
  );
}
