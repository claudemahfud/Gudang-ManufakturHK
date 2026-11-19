import type { Metadata } from 'next';
import CabangView from '@/views/cabang';

export const metadata: Metadata = {
  title: 'Manajemen Cabang & Isolasi Multi-Lokasi | Gudang Manufaktur & F&B Hub',
  description: 'Kelola kantor pusat dan cabang regional dengan isolasi akses data karyawan',
};

export default function CabangPage() {
  return <CabangView />;
}
