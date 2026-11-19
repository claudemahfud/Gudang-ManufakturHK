import type { Metadata } from 'next';
import LaporanPenjualanView from '@/views/laporan-penjualan';

export const metadata: Metadata = {
  title: 'Laporan Penjualan & Laba Bersih | Gudang Manufaktur HK',
  description: 'Laporan Penjualan detail profit, omset, HPP, diskon, dan margin',
};

export default function LaporanPenjualanPage() {
  return <LaporanPenjualanView />;
}
