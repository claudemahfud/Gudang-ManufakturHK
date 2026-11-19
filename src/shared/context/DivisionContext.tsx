'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type DivisionMode = 'MANUFAKTUR' | 'FNB';

interface DivisionContextType {
  division: DivisionMode;
  setDivision: (mode: DivisionMode) => void;
  isManufaktur: boolean;
  isFnb: boolean;
  divisionLabel: string;
}

const DivisionContext = createContext<DivisionContextType>({
  division: 'MANUFAKTUR',
  setDivision: () => {},
  isManufaktur: true,
  isFnb: false,
  divisionLabel: 'Manufaktur',
});

const COOKIE_NAME = 'app_active_division';

export function DivisionProvider({ children }: { children: React.ReactNode }) {
  const [division, setDivisionState] = useState<DivisionMode>('MANUFAKTUR');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 1. Baca dari localStorage
    const saved = localStorage.getItem('app_active_division') as DivisionMode | null;
    if (saved === 'MANUFAKTUR' || saved === 'FNB') {
      setDivisionState(saved);
      document.cookie = `${COOKIE_NAME}=${saved}; path=/; max-age=31536000`;
    } else {
      // 2. Baca dari cookie
      const match = document.cookie.match(new RegExp('(^| )' + COOKIE_NAME + '=([^;]+)'));
      if (match && (match[2] === 'MANUFAKTUR' || match[2] === 'FNB')) {
        setDivisionState(match[2] as DivisionMode);
        localStorage.setItem('app_active_division', match[2]);
      }
    }
    setMounted(true);
  }, []);

  const setDivision = (mode: DivisionMode) => {
    setDivisionState(mode);
    localStorage.setItem('app_active_division', mode);
    document.cookie = `${COOKIE_NAME}=${mode}; path=/; max-age=31536000`;
  };

  const isManufaktur = division === 'MANUFAKTUR';
  const isFnb = division === 'FNB';
  const divisionLabel = isManufaktur ? 'Manufaktur & Distribusi' : 'Food & Beverages (F&B)';

  return (
    <DivisionContext.Provider
      value={{
        division,
        setDivision,
        isManufaktur,
        isFnb,
        divisionLabel,
      }}
    >
      {children}
    </DivisionContext.Provider>
  );
}

export function useDivision() {
  return useContext(DivisionContext);
}
