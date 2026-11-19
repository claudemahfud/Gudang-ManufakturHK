import type { Metadata } from 'next';
import CashOpnameView from '@/views/cash-opname';

export const metadata: Metadata = {
  title: 'Cash Opname Laci Kasir | Gudang Manufaktur',
  description: 'Rekonsiliasi fisik uang tunai laci POS vs pencatatan sistem penjualan',
};

export default function CashOpnamePage() {
  return <CashOpnameView />;
}
