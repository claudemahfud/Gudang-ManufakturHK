'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowDownToLine, ChevronDown, ExternalLink, ShieldAlert, ShoppingBag, Truck, Zap } from 'lucide-react';
import { ROUTES } from '@/router/routes';
import { punyaRole } from '@/shared/lib/auth/roles';

// ============================================================
// Dropdown "Akses Cepat" di Navbar (di samping lonceng): 4 aksi yang paling sering dipakai.
// Role mengikuti hak akses halamannya (sama dengan ROLES_WAREHOUSE / ROLES_POS di rbac.ts;
// tidak diimpor karena rbac.ts memakai database dan hanya untuk server).
// ============================================================

const PIMPINAN = ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum'];
const GUDANG = [...PIMPINAN, 'Kepala Gudang', 'Wakil Gudang', 'Staff Gudang'];
const PENJUALAN = [
  ...GUDANG,
  'Salesman', 'Sales Canvas', 'Sales Motoris', 'Admin Salesman', 'Staff Admin Salesman',
  'Agen', 'Sales Agent', 'Admin Agen', 'Staff Admin Agen',
];

const AKSI = [
  { label: 'Terima Barang Masuk', desc: 'Catat kiriman supplier & stok masuk', href: ROUTES.BARANG_MASUK, ikon: ArrowDownToLine, warna: 'bg-emerald-600', roles: GUDANG },
  { label: 'Kirim Muatan Keluar', desc: 'Surat loading & pengiriman grosir', href: ROUTES.BARANG_KELUAR, ikon: Truck, warna: 'bg-blue-600', roles: PENJUALAN },
  { label: 'Buka Kasir POS', desc: 'Layar penuh kasir & nota thermal 58mm', href: ROUTES.POS, ikon: ShoppingBag, warna: 'bg-purple-600', roles: PENJUALAN, tabBaru: true },
  { label: 'Lapor Rusak & Retur', desc: 'Audit barang afkir & retur pelanggan', href: ROUTES.LAPORAN_RUSAK_RETUR, ikon: ShieldAlert, warna: 'bg-rose-600', roles: GUDANG },
];

export default function AksesCepat() {
  const { data: session } = useSession();
  const [buka, setBuka] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const user = session?.user as { role?: string; roles?: string[] } | undefined;
  const aksi = AKSI.filter((a) => punyaRole(user, a.roles));

  useEffect(() => {
    if (!buka) return;
    const tutup = (e: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(e.target as Node)) setBuka(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setBuka(false);
    document.addEventListener('mousedown', tutup);
    document.addEventListener('touchstart', tutup);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', tutup);
      document.removeEventListener('touchstart', tutup);
      document.removeEventListener('keydown', esc);
    };
  }, [buka]);

  if (aksi.length === 0) return null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={buka}
        aria-label="Akses Cepat"
        title="Akses Cepat"
        className="flex items-center gap-1.5 rounded-xl p-2 sm:px-3 text-gray-700 hover:bg-gray-100 transition"
      >
        <Zap className="h-4 w-4 text-amber-500 fill-amber-500" aria-hidden="true" />
        <span className="hidden sm:inline text-xs font-semibold">Akses Cepat</span>
        <ChevronDown className={`hidden sm:block h-3.5 w-3.5 text-slate-500 transition-transform ${buka ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {buka && (
        <div
          role="menu"
          className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2 sm:w-80 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Pusat Aksi Cepat</div>
          {aksi.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              role="menuitem"
              {...(a.tabBaru ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              onClick={() => setBuka(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${a.warna}`}>
                <a.ikon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-gray-900">{a.label}</span>
                <span className="block text-[11px] text-gray-500">{a.desc}</span>
              </span>
              {a.tabBaru && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
