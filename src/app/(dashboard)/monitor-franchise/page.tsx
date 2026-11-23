import type { Metadata } from 'next';
import MonitorFranchise from '@/views/monitor-franchise';

export const metadata: Metadata = {
  title: 'Monitor Franchise | Gudang Manufaktur',
  description: 'Penjualan POS, stok, dan tagihan setiap outlet franchise',
};

export default function MonitorFranchisePage() {
  return <MonitorFranchise />;
}
