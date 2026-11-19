'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { DivisionProvider } from '@/shared/context/DivisionContext';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DivisionProvider>
        {children}
      </DivisionProvider>
    </SessionProvider>
  );
}
