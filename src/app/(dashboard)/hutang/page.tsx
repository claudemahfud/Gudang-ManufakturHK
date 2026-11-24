import type { Metadata } from 'next';
import Hutang from '@/views/hutang';

export const metadata: Metadata = {
  title: 'Hutang Suplier | Gudang Manufaktur & F&B',
  description: 'Daftar dan pembayaran hutang suplier',
};

export default function HutangPage() {
  return <Hutang />;
}
