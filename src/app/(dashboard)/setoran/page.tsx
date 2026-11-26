import type { Metadata } from 'next';
import Setoran from '@/views/setoran';

export const metadata: Metadata = {
  title: 'Setoran ke Finance Pusat | Gudang Manufaktur & F&B',
  description: 'Setoran uang tunai hasil penjualan ke Finance Pusat dan konfirmasinya',
};

export default function SetoranPage() {
  return <Setoran />;
}
