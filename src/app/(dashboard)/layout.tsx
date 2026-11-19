'use client';

import { useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import Sidebar from '@/shared/components/layout/Sidebar';
import Header from '@/shared/components/layout/Header';
import { useSession } from 'next-auth/react';
import type { UserRole } from '@/shared/types';
import AssistivePosButton from '@/shared/components/pos/AssistivePosButton';
import { ShieldCheck, HeartPulse } from 'lucide-react';

// ============================================================
// LAYOUT: Dashboard (semua halaman authenticated)
// ============================================================

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const userRole = (session?.user as any)?.role as UserRole | undefined;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 relative">
      {/* 1. Holy Grail Layout: Left Semantic <aside> for Navigation */}
      <aside aria-label="Sidebar Navigasi Desktop" className="hidden lg:flex flex-shrink-0">
        <Sidebar userRole={userRole} />
      </aside>

      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <aside aria-label="Sidebar Navigasi Mobile" className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar userRole={userRole} onClose={() => setSidebarOpen(false)} />
          </aside>
        </>
      )}

      {/* 2. Main Column: Semantic <header>, <main>, and <footer> */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 overflow-y-auto flex flex-col justify-between">
          <div className="p-4 md:p-6 flex-1">
            {children}
          </div>

          {/* Semantic <footer> at base of content */}
          <footer className="mt-8 py-3.5 px-4 md:px-6 bg-white/70 border-t border-slate-200/80 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Gudang Manufaktur & F&B Hub • Multi-Cabang & RLS Aktif</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span>Sistem Operasional Normal</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-400">v2.2 Enterprise</span>
            </div>
          </footer>
        </main>
      </div>

      {/* Floating Assistive Touch Button for POS */}
      <AssistivePosButton />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </SessionProvider>
  );
}
