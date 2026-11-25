import type { Metadata } from 'next';
import Setoran from '@/views/setoran';

export const metadata: Metadata = {
  title: 'Setoran ke Finance | Gudang Manufaktur & F&B',
  description: 'Setoran uang tunai sales ke Finance dan konfirmasinya',
};

export default function SetoranPage() {
  return <Setoran />;
}
