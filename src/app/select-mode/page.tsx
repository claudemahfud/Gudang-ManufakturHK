import { Suspense } from 'react';
import type { Metadata } from 'next';
import SelectModeView from '@/views/select-mode';

export const metadata: Metadata = {
  title: 'Pilih Jalur Mode Operasional | Gudang Manufaktur & F&B',
  description: 'Pilih antara Mode Manufaktur atau Food & Beverages untuk isolasi total data barang, penjualan, dan keuangan',
};

export default function SelectModePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">Memuat...</div>}>
      <SelectModeView />
    </Suspense>
  );
}
