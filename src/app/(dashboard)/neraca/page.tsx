import { redirect } from 'next/navigation';
import { ROUTES } from '@/router/routes';

export default function NeracaPage() {
  redirect(`${ROUTES.LAPORAN_KEUANGAN}?tab=neraca`);
}
