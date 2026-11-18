'use client';

import { useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import Sidebar from '@/shared/components/layout/Sidebar';
import Header from '@/shared/components/layout/Header';
import { useSession } from 'next-auth/react';
import type { UserRole } from '@/shared/types';

// ============================================================
// LAYOUT: Dashboard (semua halaman authenticated)
// ============================================================

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const userRole = (session?.user as any)?.role as UserRole | undefined;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar Desktop */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar userRole={userRole} />
      </div>

      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar userRole={userRole} onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
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
