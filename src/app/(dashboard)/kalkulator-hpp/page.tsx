import type { Metadata } from 'next';
import KalkulatorHppView from '@/views/kalkulator-hpp';

export const metadata: Metadata = {
  title: 'Kalkulator HPP & Resep F&B | Gudang Manufaktur',
  description: 'Hitung HPP otomatis dari takaran resep bahan baku (BOM) & simulasikan margin laba F&B',
};

export default function KalkulatorHppPage() {
  return <KalkulatorHppView />;
}
