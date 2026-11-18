import { redirect } from 'next/navigation';
import { ROUTES } from '@/router/routes';

// Root → redirect ke dashboard
export default function RootPage() {
  redirect(ROUTES.DASHBOARD);
}
