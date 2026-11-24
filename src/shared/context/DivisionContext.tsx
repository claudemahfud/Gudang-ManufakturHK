'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import type { UserRole } from '@/shared/types';
import { ROUTES } from '@/router/routes';
import { roleUtamaDi } from '@/shared/lib/auth/roles';

export type DivisionMode = 'MANUFAKTUR' | 'FNB';

export interface CabangItem {
  id: number;
  kodeCabang: string;
  namaCabang: string;
  divisi: string;
  alamat?: string | null;
  telepon?: string | null;
  isPusat: boolean;
  tipe?: string;
  status: string;
}

interface DivisionContextType {
  division: DivisionMode;
  setDivision: (mode: DivisionMode) => void;
  isManufaktur: boolean;
  isFnb: boolean;
  divisionLabel: string;
  cabang: string;
  setCabang: (branch: string) => void;
  availableCabang: string[];
  allCabangList: CabangItem[];
  canSwitchDivision: boolean;
  canSwitchCabang: boolean;
  isCabangLocked: boolean;
  isBawahan: boolean;
  logoutAndSwitchMode: () => void;
  refetchCabang: () => Promise<void>;
}

const DivisionContext = createContext<DivisionContextType>({
  division: 'MANUFAKTUR',
  setDivision: () => {},
  isManufaktur: true,
  isFnb: false,
  divisionLabel: 'Manufaktur',
  cabang: 'Pusat',
  setCabang: () => {},
  availableCabang: ['Pusat'],
  allCabangList: [],
  canSwitchDivision: false,
  canSwitchCabang: false,
  isCabangLocked: false,
  isBawahan: true,
  logoutAndSwitchMode: () => {},
  refetchCabang: async () => {},
});

const COOKIE_NAME = 'app_active_division';
const CABANG_COOKIE_NAME = 'app_active_cabang';

export function DivisionProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const user = session?.user as any;
  const divisiAssigned = user?.divisiAssigned as 'ALL' | 'MANUFAKTUR' | 'FNB' | undefined;
  const userCabang = user?.cabang || 'Pusat';

  // Hanya Pimpinan (Admin, Direktur Utama, Manager) yang punya izin ganti mode & multi-cabang
  const isExecutive = roleUtamaDi(user, ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum', 'Finance & Accounting']);
  const canSwitchDivision = isExecutive || divisiAssigned === 'ALL';
  const isBawahan = !canSwitchDivision;

  // Karyawan Cabang: Jika bukan eksekutif dan cabang bukan 'Pusat' / 'ALL', terkunci ke cabangnya sendiri!
  const isBranchEmployee = !isExecutive && userCabang !== 'ALL' && userCabang !== 'Pusat';

  const [division, setDivisionState] = useState<DivisionMode>('MANUFAKTUR');
  const [cabang, setCabangState] = useState<string>(isBranchEmployee ? userCabang : 'Pusat');
  const [allCabangList, setAllCabangList] = useState<CabangItem[]>([]);
  const [availableCabang, setAvailableCabang] = useState<string[]>(['Pusat']);

  // Fetch daftar cabang aktif dari API
  const refetchCabang = useCallback(async () => {
    if (isBranchEmployee) {
      setAvailableCabang([userCabang]);
      setCabangState(userCabang);
      return;
    }

    try {
      const res = await fetch(`/api/cabang?divisi=${division}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setAllCabangList(json.data);
        const names = json.data.map((c: CabangItem) => c.namaCabang);
        setAvailableCabang(names);

        // Validasi apakah cabang yang tersimpan masih valid di daftar cabang
        setCabangState((current) => {
          if (names.includes(current)) return current;
          const saved = localStorage.getItem('app_active_cabang');
          if (saved && names.includes(saved)) return saved;
          return 'Pusat';
        });
      } else {
        // Fallback default: Hanya Pusat
        setAvailableCabang(['Pusat']);
        setCabangState('Pusat');
      }
    } catch (err) {
      console.error('Failed to fetch cabang:', err);
      setAvailableCabang(['Pusat']);
    }
  }, [division, isBranchEmployee, userCabang]);

  useEffect(() => {
    // 1. Inisialisasi Divisi
    if (divisiAssigned === 'MANUFAKTUR') {
      setDivisionState('MANUFAKTUR');
      localStorage.setItem('app_active_division', 'MANUFAKTUR');
      document.cookie = `${COOKIE_NAME}=MANUFAKTUR; path=/; max-age=31536000`;
    } else if (divisiAssigned === 'FNB') {
      setDivisionState('FNB');
      localStorage.setItem('app_active_division', 'FNB');
      document.cookie = `${COOKIE_NAME}=FNB; path=/; max-age=31536000`;
    } else {
      const saved = localStorage.getItem('app_active_division') as DivisionMode | null;
      if (saved === 'MANUFAKTUR' || saved === 'FNB') {
        setDivisionState(saved);
        document.cookie = `${COOKIE_NAME}=${saved}; path=/; max-age=31536000`;
      }
    }

    // 2. Inisialisasi Cabang
    if (isBranchEmployee) {
      setCabangState(userCabang);
      setAvailableCabang([userCabang]);
      localStorage.setItem('app_active_cabang', userCabang);
      document.cookie = `${CABANG_COOKIE_NAME}=${encodeURIComponent(userCabang)}; path=/; max-age=31536000`;
    } else {
      refetchCabang();
    }
  }, [divisiAssigned, isBranchEmployee, userCabang, refetchCabang]);

  const setDivision = (mode: DivisionMode) => {
    if (isBawahan) return;
    setDivisionState(mode);
    localStorage.setItem('app_active_division', mode);
    document.cookie = `${COOKIE_NAME}=${mode}; path=/; max-age=31536000`;
  };

  const setCabang = (newCabang: string) => {
    // Karyawan cabang tidak boleh berpindah cabang
    if (isBranchEmployee) return;

    setCabangState(newCabang);
    localStorage.setItem('app_active_cabang', newCabang);
    document.cookie = `${CABANG_COOKIE_NAME}=${encodeURIComponent(newCabang)}; path=/; max-age=31536000`;
  };

  // Aturan Bisnis: Ganti Mode WAJIB LOGOUT DULU!
  const logoutAndSwitchMode = () => {
    localStorage.removeItem('app_active_division');
    localStorage.removeItem('app_active_cabang');
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
    document.cookie = `${CABANG_COOKIE_NAME}=; path=/; max-age=0`;
    signOut({ callbackUrl: ROUTES.LOGIN });
  };

  const isManufaktur = division === 'MANUFAKTUR';
  const isFnb = division === 'FNB';
  const divisionLabel = isManufaktur ? 'Manufaktur & Distribusi' : 'Food & Beverages (F&B)';

  // canSwitchCabang: hanya aktif jika bukan karyawan cabang DAN ada lebih dari 1 cabang di sistem
  const canSwitchCabang = !isBranchEmployee && availableCabang.length > 1;
  const isCabangLocked = isBranchEmployee;

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
        allCabangList,
        canSwitchDivision,
        canSwitchCabang,
        isCabangLocked,
        isBawahan,
        logoutAndSwitchMode,
        refetchCabang,
      }}
    >
      {children}
    </DivisionContext.Provider>
  );
}

export function useDivision() {
  return useContext(DivisionContext);
}
