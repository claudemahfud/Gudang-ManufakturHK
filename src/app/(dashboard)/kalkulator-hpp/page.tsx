import type { Metadata } from 'next';
import MasterResep from '@/views/kalkulator-hpp';

export const metadata: Metadata = {
  title: 'Master Resep & HPP | Gudang Manufaktur',
  description: 'Resep per batch Dapur Pusat: bahan baku, biaya lain-lain, HPP per unit, dan harga franchise',
};

export default function MasterResepPage() {
  return <MasterResep />;
}
