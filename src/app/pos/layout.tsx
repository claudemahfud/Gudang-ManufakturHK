'use client';

import { SessionProvider } from 'next-auth/react';

// ============================================================
// STANDALONE POS LAYOUT (Terpisah 100% dari BackOffice Gudang)
// Tidak ada Sidebar, tidak ada Header BackOffice
// Satu layar penuh hanya untuk Point of Sales (POS)
// ============================================================

export default function PosStandaloneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen w-screen overflow-x-hidden bg-slate-950 font-sans antialiased text-slate-100">
        {children}
      </div>
    </SessionProvider>
  );
}
