import type { Metadata } from 'next';
import PengaturanPerusahaanView from '@/views/pengaturan-perusahaan';

export const metadata: Metadata = {
  title: 'Pengaturan Perusahaan | Gudang Manufaktur & F&B Hub',
  description: 'Atur kewajiban PIN supervisor untuk diskon, void keranjang, dan hapus transaksi',
};

export default function PengaturanPerusahaanPage() {
  return <PengaturanPerusahaanView />;
}
