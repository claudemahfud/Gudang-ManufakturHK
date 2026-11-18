import Dashboard from '@/views/dashboard';

// ============================================================
// APP PAGE: Dashboard
// Route: /dashboard
// ============================================================

export const metadata = {
  title: 'Dashboard | Gudang Manufaktur HK',
  description: 'Ringkasan operasional dan statistik inventaris pergudangan',
};

export default function DashboardPage() {
  return <Dashboard />;
}

