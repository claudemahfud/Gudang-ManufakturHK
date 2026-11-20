'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/router/routes';

// ============================================================
// DEPRECATED: Replaced by /laporan-rusak-retur (LaporanRusakRetur)
// ============================================================

export default function BarangRusak() {
  const router = useRouter();

  useEffect(() => {
    router.replace(ROUTES.LAPORAN_RUSAK_RETUR);
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400">
      Mengalihkan ke Laporan Rusak &amp; Retur...
    </div>
  );
}
