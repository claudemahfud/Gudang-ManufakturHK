import type { Metadata, Viewport } from 'next';
import PosView from '@/views/pos';

export const metadata: Metadata = {
  title: 'Point of Sales (POS) Kasir Mobile | Gudang Manufaktur HK',
  description: 'Layar Penuh POS Kasir Mobile & Cetak Nota Thermal 58mm untuk Smartphone & Tablet',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#020617',
};

export default function StandalonePosPage() {
  return <PosView />;
}
