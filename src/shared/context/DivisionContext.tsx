'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import type { UserRole } from '@/shared/types';
import { ROUTES } from '@/router/routes';

export type DivisionMode = 'MANUFAKTUR' | 'FNB';

interface DivisionContextType {
  division: DivisionMode;
  setDivision: (mode: DivisionMode) => void;
  isManufaktur: boolean;
  isFnb: boolean;
  divisionLabel: string;
  cabang: string;
  setCabang: (branch: string) => void;
  availableCabang: string[];
  canSwitchDivision: boolean;
  isBawahan: boolean;
  logoutAndSwitchMode: () => void;
}

const CABANG_MANUFAKTUR = [
  'Cabang Pusat (Pabrik)',
  'Gudang Cikarang',
  'Depo Surabaya',
];

const CABANG_FNB = [
  'Outlet 1 (Pusat)',
  'Outlet 2 (Senopati)',
  'Outlet 3 (Bandung)',
];

const DivisionContext = createContext<DivisionContextType>({
  division: 'MANUFAKTUR',
  setDivision: () => {},
  isManufaktur: true,
  isFnb: false,
  divisionLabel: 'Manufaktur',
  cabang: 'Cabang Pusat (Pabrik)',
  setCabang: () => {},
  availableCabang: CABANG_MANUFAKTUR,
  canSwitchDivision: false,
  isBawahan: true,
  logoutAndSwitchMode: () => {},
});

const COOKIE_NAME = 'app_active_division';
const CABANG_COOKIE_NAME = 'app_active_cabang';

export function DivisionProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const user = session?.user as any;
  const userRole = user?.role as UserRole | undefined;
  const divisiAssigned = user?.divisiAssigned as 'ALL' | 'MANUFAKTUR' | 'FNB' | undefined;

  // Hanya Pimpinan (Admin, Direktur Utama, Manager) atau user dengan divisi_assigned === 'ALL' yang punya izin ganti mode
  const isExecutive = ['Administrator', 'Direktur Utama', 'Manager'].includes(userRole as any);
  const canSwitchDivision = isExecutive || divisiAssigned === 'ALL';
  const isBawahan = !canSwitchDivision;

  const [division, setDivisionState] = useState<DivisionMode>('MANUFAKTUR');
  const [cabang, setCabangState] = useState<string>('Cabang Pusat (Pabrik)');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 1. Jika bawahan dan sudah di-assign mode tertentu di awal, kunci mati ke divisi tersebut!
    if (divisiAssigned === 'MANUFAKTUR') {
      setDivisionState('MANUFAKTUR');
      localStorage.setItem('app_active_division', 'MANUFAKTUR');
      document.cookie = `${COOKIE_NAME}=MANUFAKTUR; path=/; max-age=31536000`;
    } else if (divisiAssigned === 'FNB') {
      setDivisionState('FNB');
      localStorage.setItem('app_active_division', 'FNB');
      document.cookie = `${COOKIE_NAME}=FNB; path=/; max-age=31536000`;
    } else {
      // Pimpinan (ALL): baca dari localStorage / cookie
      const saved = localStorage.getItem('app_active_division') as DivisionMode | null;
      if (saved === 'MANUFAKTUR' || saved === 'FNB') {
        setDivisionState(saved);
        document.cookie = `${COOKIE_NAME}=${saved}; path=/; max-age=31536000`;
      }
    }

    // Baca cabang
    const savedCabang = localStorage.getItem('app_active_cabang');
    if (savedCabang) {
      setCabangState(savedCabang);
    }

    setMounted(true);
  }, [divisiAssigned]);

  const setDivision = (mode: DivisionMode) => {
    // Bawahan tidak boleh ganti mode
    if (isBawahan) return;
    setDivisionState(mode);
    localStorage.setItem('app_active_division', mode);
    document.cookie = `${COOKIE_NAME}=${mode}; path=/; max-age=31536000`;
  };

  const setCabang = (newCabang: string) => {
    setCabangState(newCabang);
    localStorage.setItem('app_active_cabang', newCabang);
    document.cookie = `${CABANG_COOKIE_NAME}=${encodeURIComponent(newCabang)}; path=/; max-age=31536000`;
  };

  // Aturan Bisnis: Ganti Mode WAJIB LOGOUT DULU!
  const logoutAndSwitchMode = () => {
    localStorage.removeItem('app_active_division');
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
    signOut({ callbackUrl: ROUTES.LOGIN });
  };

  const isManufaktur = division === 'MANUFAKTUR';
  const isFnb = division === 'FNB';
  const divisionLabel = isManufaktur ? 'Manufaktur & Distribusi' : 'Food & Beverages (F&B)';
  const availableCabang = isManufaktur ? CABANG_MANUFAKTUR : CABANG_FNB;

  return (
    <DivisionContext.Provider
      value={{
        division,
        setDivision,
        isManufaktur,
        isFnb,
        divisionLabel,
        cabang,
        setCabang,
        availableCabang,
        canSwitchDivision,
        isBawahan,
        logoutAndSwitchMode,
      }}
    >
      {children}
    </DivisionContext.Provider>
  );
}

export function useDivision() {
  return useContext(DivisionContext);
}
