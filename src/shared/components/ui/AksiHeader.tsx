'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

// Tombol ringkas untuk pojok kanan header halaman: aksi sekunder (segarkan, ekspor, cetak)
// jadi ikon dalam satu grup, aksi utama tetap berlabel tapi kecil.

/** Wadah aksi header: tetap di pojok kanan atas, tidak melebar. */
export function AksiHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex shrink-0 flex-wrap items-center gap-2 sm:self-start">{children}</div>;
}

/** Grup tombol ikon bersambung. */
export function GrupIkon({ children, label = 'Aksi halaman' }: { children: React.ReactNode; label?: string }) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 shadow-xs print:hidden"
    >
      {children}
    </div>
  );
}

const WARNA_IKON = {
  abu: 'text-gray-500 hover:text-gray-900',
  hijau: 'text-emerald-600 hover:text-emerald-800',
  merah: 'text-red-600 hover:text-red-700',
  slate: 'text-slate-700 hover:text-slate-950',
} as const;

/** Tombol ikon kecil; label tampil sebagai tooltip dan dibaca pembaca layar. */
export function TombolIkon({
  ikon: Ikon,
  label,
  onClick,
  href,
  disabled,
  putar,
  warna = 'abu',
}: {
  ikon: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** Ikon berputar (mis. saat memuat ulang). */
  putar?: boolean;
  warna?: keyof typeof WARNA_IKON;
}) {
  const kelas = `inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:opacity-50 disabled:pointer-events-none ${WARNA_IKON[warna]}`;
  const isi = <Ikon className={`h-4 w-4 ${putar ? 'animate-spin' : ''}`} aria-hidden="true" />;
  if (href)
    return (
      <Link href={href} title={label} aria-label={label} className={kelas}>
        {isi}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className={kelas}>
      {isi}
    </button>
  );
}

const WARNA_UTAMA = {
  hijau: 'bg-emerald-600 hover:bg-emerald-700',
  merah: 'bg-red-600 hover:bg-red-700',
  biru: 'bg-blue-600 hover:bg-blue-700',
  gelap: 'bg-gray-900 hover:bg-gray-800',
} as const;

/** Aksi utama halaman: berlabel, tinggi sama dengan grup ikon. */
export function TombolUtama({
  ikon: Ikon,
  children,
  onClick,
  warna = 'hijau',
}: {
  ikon?: LucideIcon;
  children: React.ReactNode;
  onClick: () => void;
  warna?: keyof typeof WARNA_UTAMA;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white shadow-sm transition-colors active:scale-[0.97] print:hidden ${WARNA_UTAMA[warna]}`}
    >
      {Ikon && <Ikon className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}
