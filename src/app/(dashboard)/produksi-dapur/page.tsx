import type { Metadata } from 'next';
import ProduksiDapur from '@/views/produksi-dapur';

export const metadata: Metadata = {
  title: 'Produksi Dapur Pusat | Gudang Manufaktur',
  description: 'Masak per batch dari Master Resep, potong bahan, tambah produk jadi',
};

export default function ProduksiDapurPage() {
  return <ProduksiDapur />;
}
