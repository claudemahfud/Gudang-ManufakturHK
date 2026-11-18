import { Suspense } from 'react';
import Login from '@/views/login';

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

