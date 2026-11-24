import type { Metadata } from 'next';
import Jurnal from '@/views/jurnal';

export const metadata: Metadata = {
  title: 'Jurnal & Buku Besar | Gudang Manufaktur & F&B',
  description: 'Jurnal umum, buku besar, dan bagan akun',
};

export default function JurnalPage() {
  return <Jurnal />;
}
