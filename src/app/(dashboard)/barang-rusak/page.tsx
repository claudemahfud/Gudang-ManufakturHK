import { redirect } from 'next/navigation';
import { ROUTES } from '@/router/routes';

export default function BarangRusakPage() {
  redirect(ROUTES.LAPORAN_RUSAK_RETUR);
}
