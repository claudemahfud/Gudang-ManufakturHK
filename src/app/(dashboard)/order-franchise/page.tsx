import type { Metadata } from 'next';
import OrderFranchise from '@/views/order-franchise';

export const metadata: Metadata = {
  title: 'Order Franchise | Gudang Manufaktur',
  description: 'Order produk franchise ke Dapur Pusat: kirim, terima, tagihan',
};

export default function OrderFranchisePage() {
  return <OrderFranchise />;
}
