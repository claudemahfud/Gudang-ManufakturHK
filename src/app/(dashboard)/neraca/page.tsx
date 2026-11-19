import type { Metadata } from 'next';
import NeracaView from '@/views/neraca';

export const metadata: Metadata = {
  title: 'Neraca Posisi Keuangan & Persediaan | Gudang Manufaktur & F&B',
  description: 'Pernyataan posisi keuangan konsolidasi holding serta per divisi Manufaktur dan Food & Beverages',
};

export default function NeracaPage() {
  return <NeracaView />;
}
