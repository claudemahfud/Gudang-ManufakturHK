'use client';

import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';

// ============================================================
// SHARED COMPONENT: Header (top bar)
// Dipakai oleh semua halaman dalam layout (dashboard)
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
    <header className="h-16 bg-white border-b border-gray-100 flex items-center px-4 gap-4 sticky top-0 z-30">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl hover:bg-gray-50 text-gray-500 transition"
      >
        ☰
      </button>

      {/* Title */}
      {title && (
        <h1 className="text-base font-semibold text-gray-700 hidden sm:block">{title}</h1>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notifications */}
      <button className="relative p-2 rounded-xl hover:bg-gray-50 text-gray-500 transition">
        🔔
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
      </button>

      {/* User avatar + dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowUserMenu((p) => !p)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition"
        >
          <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-sm">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-sm font-semibold text-gray-700 leading-tight">{user?.name}</div>
            <div className="text-xs text-gray-400">{user?.role}</div>
          </div>
          <span className="text-gray-400 text-xs">▾</span>
        </button>

        {/* Dropdown */}
        {showUserMenu && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="text-sm font-semibold text-gray-700">{user?.name}</div>
              <div className="text-xs text-gray-400">{user?.role}</div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
            >
              🚪 Keluar
            </button>
          </div>
        )}
      </div>

      {/* Overlay to close user menu */}
      {showUserMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
      )}
    </header>
  );
}
