import type { Metadata } from 'next';
import ProdukTerjualView from '@/views/produk-terjual';

export const metadata: Metadata = {
  title: 'Produk Detile Terjual, Rusak & Retur | Gudang Manufaktur HK',
  description: 'Rekapitulasi produk terjual, barang terbuang, dan retur by qty per hari dan per jam',
};

export default function ProdukTerjualPage() {
  return <ProdukTerjualView />;
}
