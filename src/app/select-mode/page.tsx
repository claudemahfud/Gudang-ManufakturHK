import { Suspense } from 'react';
import type { Metadata } from 'next';
import SelectModeView from '@/views/select-mode';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';

export const metadata: Metadata = {
  title: 'Pilih Jalur Mode Operasional | Gudang Manufaktur & F&B',
  description: 'Pilih antara Mode Manufaktur atau Food & Beverages untuk isolasi total data barang, penjualan, dan keuangan',
};

export default function SelectModePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><MemuatProgres teks="Memuat..." gelap /></div>}>
      <SelectModeView />
    </Suspense>
  );
}
