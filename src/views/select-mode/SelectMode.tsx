'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useDivision, DivisionMode } from '@/shared/context/DivisionContext';
import { ROUTES } from '@/router/routes';
import {
  Factory,
  Coffee,
  Boxes,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Package,
  Receipt,
  LogOut,
  Sparkles,
} from 'lucide-react';

export default function SelectMode() {
  const router = useRouter();
  const { data: session } = useSession();
  const { setDivision } = useDivision();
  const [selected, setSelected] = useState<DivisionMode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Jika akun Bawahan yang divisinya sudah ditentukan di awal, auto-redirect ke Dashboard
  useEffect(() => {
    const divisiAssigned = (session?.user as any)?.divisiAssigned;
    if (divisiAssigned && divisiAssigned !== 'ALL') {
      setDivision(divisiAssigned);
      router.replace(ROUTES.DASHBOARD);
    }
  }, [session, router, setDivision]);

  const userName = session?.user?.name || 'Administrator';
  const userRole = (session?.user as any)?.role || 'Petugas';

  const handleSelect = (mode: DivisionMode) => {
    setSelected(mode);
    setSubmitting(true);
    setDivision(mode);

    // Animasi transisi halus menuju dashboard
    setTimeout(() => {
      router.push(ROUTES.DASHBOARD);
      router.refresh();
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 select-none relative overflow-hidden">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between max-w-5xl mx-auto w-full py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white text-slate-950 flex items-center justify-center font-bold shadow-md">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white leading-tight">
              Gudang Manufaktur & F&B Hub
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Multi-Domain Platform Terpadu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold text-slate-200">{userName}</span>
            <span className="text-[10px] text-slate-400">{userRole}</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: ROUTES.LOGIN })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 hover:bg-slate-900 transition-all text-xs"
            title="Keluar dari Akun"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Choice Section */}
      <main className="relative z-10 max-w-5xl mx-auto w-full my-auto py-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300 mb-4">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Satu Akun &bull; Dua Domain Operasional Mandiri</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Pilih Jalur Mode Operasional
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2">
            Warehouse dan Point of Sales (POS) dari kedua divisi terisolasi penuh sehingga data barang, stok, penjualan, dan keuangan tidak saling bercampur.
          </p>
        </div>

        {/* 2 Big Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CARD 1: MANUFAKTUR */}
          <div
            onClick={() => !submitting && handleSelect('MANUFAKTUR')}
            className={`group cursor-pointer relative rounded-2xl p-6 sm:p-8 border transition-all duration-300 flex flex-col justify-between ${
              selected === 'MANUFAKTUR'
                ? 'bg-slate-900 border-white ring-2 ring-white shadow-xl scale-[1.01]'
                : 'bg-slate-900/70 border-slate-800 hover:border-slate-600 hover:bg-slate-900 hover:shadow-lg'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <span className="text-[11px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Jalur 1 &bull; Pabrik & Distribusi
                </span>
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                  <Factory className="w-6 h-6" />
                </div>
              </div>

              <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                Divisi Manufaktur
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Manajemen gudang industri, persediaan karton/bal/kemasan, surat jalan logistik, PO loading, dan kasir POS toko grosir.
              </p>

              {/* Feature Points */}
              <div className="mt-6 space-y-2.5 pt-5 border-t border-slate-800/80 text-xs text-slate-300">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span>Stok Pabrik & Bahan Kemasan (Pcs/Bal/Karton)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span>Surat Jalan & PO Loading Pengiriman</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span>Kasir POS Manufaktur (Nota 58mm Standalone)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span>Laporan Laba, Margin & Evaluasi Barang Rusak</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4">
              <button
                type="button"
                disabled={submitting}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  selected === 'MANUFAKTUR'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 text-white group-hover:bg-blue-600'
                }`}
              >
                <span>Masuk Mode Manufaktur</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* CARD 2: FOOD AND BEVERAGES */}
          <div
            onClick={() => !submitting && handleSelect('FNB')}
            className={`group cursor-pointer relative rounded-2xl p-6 sm:p-8 border transition-all duration-300 flex flex-col justify-between ${
              selected === 'FNB'
                ? 'bg-slate-900 border-white ring-2 ring-white shadow-xl scale-[1.01]'
                : 'bg-slate-900/70 border-slate-800 hover:border-slate-600 hover:bg-slate-900 hover:shadow-lg'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <span className="text-[11px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Jalur 2 &bull; Cafe, Resto & Bakery
                </span>
                <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                  <Coffee className="w-6 h-6" />
                </div>
              </div>

              <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                Divisi Food & Beverages (F&B)
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Manajemen bahan baku cafe/resto (gram, ml, porsi), kalkulator takaran resep HPP (BOM), kasir POS cafe, dan cash opname laci.
              </p>

              {/* Feature Points */}
              <div className="mt-6 space-y-2.5 pt-5 border-t border-slate-800/80 text-xs text-slate-300">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Bahan Baku Kopi, Susu, Pemanis & Cup Plastik</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Kalkulator HPP & Resep Otomatis (BOM Recipe)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Kasir POS Cafe/Resto (Potong Stok Bahan Otomatis)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Rekonsiliasi Cash Opname Laci Kasir Per Shift</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4">
              <button
                type="button"
                disabled={submitting}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  selected === 'FNB'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-800 text-white group-hover:bg-emerald-600'
                }`}
              >
                <span>Masuk Mode Food & Beverages</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Note */}
      <footer className="relative z-10 text-center max-w-5xl mx-auto w-full py-4 border-t border-slate-900 text-[11px] text-slate-500">
        <p>
          Privasi Terjamin &bull; Mode yang Anda pilih terkunci selama sesi aktif. Untuk berpindah mode, wajib Logout terlebih dahulu.
        </p>
      </footer>
    </div>
  );
}
