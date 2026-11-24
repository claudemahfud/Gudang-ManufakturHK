import type { Metadata } from 'next';
import { Suspense } from 'react';
import LaporanKeuangan from '@/views/laporan-keuangan';

export const metadata: Metadata = {
  title: 'Laporan Keuangan | Gudang Manufaktur & F&B',
  description: 'Neraca, laba rugi, dan arus kas per perusahaan',
};

export default function LaporanKeuanganPage() {
  return (
    <Suspense>
      <LaporanKeuangan />
    </Suspense>
  );
}
