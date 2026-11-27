'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import Sidebar from '@/shared/components/layout/Sidebar';
import Header from '@/shared/components/layout/Header';
import { useSession } from 'next-auth/react';
import AssistivePosButton from '@/shared/components/pos/AssistivePosButton';
import SesiHabis from '@/shared/components/layout/SesiHabis';
import { HeartPulse } from 'lucide-react';
import { rolesOf } from '@/shared/lib/auth/roles';
import { usePintasanSinkron } from '@/shared/lib/pintasan-sinkron';
import { useLabelTabelHp } from '@/shared/lib/label-tabel';
import { useGesekSidebar } from '@/shared/lib/gesek-sidebar';

// ============================================================
// LAYOUT: Dashboard (semua halaman authenticated)
// ============================================================

// Preferensi buka/tutup sidebar desktop di localStorage (server render: terbuka)
const SIDEBAR_PREF_KEY = 'sidebar_desktop_open';
const SIDEBAR_PREF_EVENT = 'sidebar-pref-change';

function readSidebarPref(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_PREF_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeSidebarPref(open: boolean) {
  try {
    localStorage.setItem(SIDEBAR_PREF_KEY, open ? '1' : '0');
  } catch {
    // storage diblokir: perubahan hanya berlaku sampai reload
  }
  window.dispatchEvent(new Event(SIDEBAR_PREF_EVENT));
}

function subscribeSidebarPref(onChange: () => void) {
  window.addEventListener(SIDEBAR_PREF_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(SIDEBAR_PREF_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { data: session, update } = useSession();
  const namaSesi = session?.user?.name;
  const adaSesi = Boolean(session);
  const sudahCekNama = useRef(false);
  // Alt+R: tombol sinkron halaman aktif
  usePintasanSinkron();
  // HP: semua tabel tampil sebagai kartu berlabel (lihat globals.css .tabel-kartu)
  useLabelTabelHp();

  // Nama di token bisa basi (diubah Administrator / dari perangkat lain): samakan dengan DB
  useEffect(() => {
    if (!adaSesi || sudahCekNama.current) return;
    sudahCekNama.current = true;
    fetch('/api/profile')
      .then((r) => r.json())
      .then((j) => {
        const namaDb = j?.data?.namaLengkap;
        if (j?.success && namaDb && namaDb !== namaSesi) update({ name: namaDb });
      })
      .catch(() => {});
    // sekali per pemuatan halaman (dijaga ref)
  }, [adaSesi, namaSesi, update]);
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Sidebar desktop bisa disembunyikan; pilihan diingat per perangkat
  const desktopSidebarOpen = useSyncExternalStore(subscribeSidebarPref, readSidebarPref, () => true);
  const userRoles = rolesOf(session?.user as { role?: string; roles?: string[] } | undefined);

  // HP/tablet: geser kanan = buka sidebar, geser kiri = tutup (lihat gesek-sidebar.ts)
  useGesekSidebar(sidebarOpen, setSidebarOpen);

  const toggleSidebar = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      writeSidebarPref(!desktopSidebarOpen);
    } else {
      setSidebarOpen((open) => !open);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 relative">
      {/* 1. Holy Grail Layout: Left Semantic <aside> for Navigation */}
      {desktopSidebarOpen && (
        <aside aria-label="Sidebar Navigasi Desktop" className="hidden lg:flex flex-shrink-0">
          <Sidebar userRoles={userRoles} />
        </aside>
      )}

      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden animate-in fade-in duration-200"
            onClick={() => setSidebarOpen(false)}
          />
          <aside
            aria-label="Sidebar Navigasi Mobile"
            className="fixed inset-y-0 left-0 z-50 lg:hidden animate-in slide-in-from-left duration-300 [animation-timing-function:var(--ease-drawer)]"
          >
            <Sidebar userRoles={userRoles} onClose={() => setSidebarOpen(false)} />
          </aside>
        </>
      )}

      {/* 2. Main Column: Semantic <header>, <main>, and <footer> */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={toggleSidebar} />
        
        <main className="flex-1 overflow-y-auto flex flex-col justify-between">
          {/* key = pathname: konten halaman baru muncul dengan fade halus */}
          <div key={pathname} className="p-4 md:p-6 flex-1 animate-in fade-in slide-in-from-bottom-1 duration-200">
            {children}
          </div>

          {/* Semantic <footer> at base of content */}
          <footer className="mt-8 py-3.5 px-4 md:px-6 bg-white/70 border-t border-slate-200/80 text-[11px] text-slate-500 text-center">
            ©Hikimori 2026
          </footer>
        </main>
      </div>

      {/* Floating Assistive Touch Button for POS */}
      <AssistivePosButton />

      <SesiHabis />
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
