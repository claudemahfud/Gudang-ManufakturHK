'use client';

import { isiKartonOf, type InfoSatuanProduk, type SatuanBarang } from '@/shared/lib/satuan';

interface PilihSatuanProps {
  value: SatuanBarang;
  onChange: (satuan: SatuanBarang) => void;
  produk?: InfoSatuanProduk | null;
  /** Jika true (default), tombol Karton selalu bisa diklik untuk semua barang. */
  allowKartonBaru?: boolean;
  disabled?: boolean;
  compact?: boolean;
  ariaLabel?: string;
}

/**
 * Pemilih satuan tinggal klik ('pcs' | 'karton') yang otomatis terhubung ke Master Inventory.
 * Tidak perlu mengetik satuan manual.
 */
export default function PilihSatuan({
  value,
  onChange,
  produk,
  allowKartonBaru = true,
  disabled = false,
  compact = false,
  ariaLabel = 'Pilih satuan barang',
}: PilihSatuanProps) {
  const isi = isiKartonOf(produk);
  const kartonTersedia = isi > 1 || allowKartonBaru;

  const btnBase = compact
    ? 'px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition cursor-pointer'
    : 'px-3 py-2 text-xs font-semibold rounded-xl transition cursor-pointer';

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-100 p-0.5 ${
        disabled ? 'opacity-60 pointer-events-none' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onChange('pcs')}
        className={`${btnBase} ${
          value === 'pcs'
            ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        pcs
      </button>
      <button
        type="button"
        disabled={!kartonTersedia}
        onClick={() => kartonTersedia && onChange('karton')}
        title={
          isi > 1
            ? `1 karton = ${isi} pcs`
            : allowKartonBaru
              ? 'Pilih untuk mengisi isi per karton'
              : 'Satuan karton belum diaktifkan di Master Inventory'
        }
        className={`${btnBase} ${
          value === 'karton'
            ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200'
            : kartonTersedia
              ? 'text-gray-600 hover:text-gray-900'
              : 'text-gray-400 cursor-not-allowed opacity-50'
        }`}
      >
        karton{isi > 1 ? ` (${isi})` : ''}
      </button>
    </div>
  );
}
