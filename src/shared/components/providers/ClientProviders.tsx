'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { DivisionProvider } from '@/shared/context/DivisionContext';
import ToastGagal from '@/shared/components/ui/ToastGagal';
import ShareSheet from '@/shared/components/ui/ShareSheet';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DivisionProvider>
        {children}
        <ToastGagal />
        <ShareSheet />
      </DivisionProvider>
    </SessionProvider>
  );
}
