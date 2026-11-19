import Profile from '@/views/profile';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pengaturan Profil Akun | Gudang Manufaktur & F&B Hub',
  description: 'Kelola data profil, ganti kata sandi, dan pengaturan jalur mode operasional.',
};

export default function ProfilePage() {
  return <Profile />;
}
