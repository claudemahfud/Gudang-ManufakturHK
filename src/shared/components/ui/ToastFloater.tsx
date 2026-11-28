'use client';

import React from 'react';
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, X } from 'lucide-react';
import SwipeDismiss from '@/shared/components/ui/SwipeDismiss';

export interface ToastData {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  penyebab?: string;
}

interface ToastFloaterProps {
  toast: ToastData | null;
  onClose: () => void;
}

export function ToastFloater({ toast, onClose }: ToastFloaterProps) {
  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isWarning = toast.type === 'warning';
  const isInfo = toast.type === 'info';

  return (
    <div className="fixed top-4 inset-x-3 sm:inset-x-auto sm:top-5 sm:right-5 z-[9999] sm:max-w-md sm:w-full animate-in slide-in-from-top-3 duration-200">
      <SwipeDismiss onDismiss={onClose}>
        <div
          className={`p-4 rounded-2xl shadow-2xl flex items-start gap-3 border backdrop-blur-md transition-all ${
          isSuccess
            ? 'bg-emerald-900/95 text-white border-emerald-500/50 shadow-emerald-950/25'
            : isWarning
            ? 'bg-amber-900/95 text-white border-amber-500/50 shadow-amber-950/25'
            : isInfo
            ? 'bg-sky-900/95 text-white border-sky-500/50 shadow-sky-950/25'
            : 'bg-red-950/95 text-white border-red-500/50 shadow-red-950/35'
        }`}
      >
        <div className="shrink-0 mt-0.5">
          {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
          {isInfo && <Info className="w-5 h-5 text-sky-400" />}
          {!isSuccess && !isWarning && !isInfo && <AlertOctagon className="w-5 h-5 text-red-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              {toast.title ||
                (isSuccess
                  ? 'Eksekusi Berhasil'
                  : isWarning
                  ? 'Peringatan'
                  : isInfo
                  ? 'Informasi'
                  : 'Eksekusi Gagal')}
            </h4>
          </div>
          <p className="text-xs text-white/95 mt-1 font-medium leading-relaxed">
            {toast.message}
          </p>
          {toast.penyebab && (
            <div className="mt-2 p-2.5 rounded-xl bg-black/40 border border-white/10 text-[11px] text-red-200 leading-relaxed font-sans">
              <span className="font-bold text-amber-300">Penyebab: </span>
              {toast.penyebab}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          aria-label="Tutup notifikasi"
        >
          <X className="w-4 h-4" />
        </button>
        </div>
      </SwipeDismiss>
    </div>
  );
}
