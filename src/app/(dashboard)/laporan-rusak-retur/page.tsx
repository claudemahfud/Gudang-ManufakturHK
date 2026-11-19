import type { Metadata } from 'next';
import LaporanRusakReturView from '@/views/laporan-rusak-retur';

export const metadata: Metadata = {
  title: 'Laporan Barang Rusak & Retur | Gudang Manufaktur HK',
  description: 'Rekapitulasi kerugian barang rusak, afkir terbuang, dan retur pengembalian pelanggan',
};

export default function LaporanRusakReturPage() {
  return <LaporanRusakReturView />;
}
