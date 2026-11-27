'use client';

import { ShieldAlert } from 'lucide-react';
import { formatRupiah } from '@/shared/lib/utils';

// Alat bersama halaman pembukuan (laporan keuangan, jurnal, hutang, kesehatan bisnis).

export const ROLES_PEMBUKUAN = ['Direktur Utama', 'Manager', 'Manager Umum'];

export const PESAN_TERLARANG = 'Khusus Direktur Utama & Manager';

/** Tanggal YYYY-MM-DD menurut WIB. */
export const tglWib = (d: Date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);

export type Preset = 'bulan-ini' | 'bulan-lalu' | 'tahun-ini';
export const PRESET: { kunci: Preset; label: string }[] = [
  { kunci: 'bulan-ini', label: 'Bulan Ini' },
  { kunci: 'bulan-lalu', label: 'Bulan Lalu' },
  { kunci: 'tahun-ini', label: 'Tahun Ini' },
];

export function rentangPreset(p: Preset): { dari: string; sampai: string } {
  const hari = tglWib();
  const [t, b] = hari.split('-').map(Number);
  if (p === 'tahun-ini') return { dari: `${t}-01-01`, sampai: hari };
  if (p === 'bulan-ini') return { dari: `${hari.slice(0, 8)}01`, sampai: hari };
  const tl = b === 1 ? t - 1 : t;
  const bl = b === 1 ? 12 : b - 1;
  const akhir = new Date(Date.UTC(tl, bl, 0)).getUTCDate();
  const bb = String(bl).padStart(2, '0');
  return { dari: `${tl}-${bb}-01`, sampai: `${tl}-${bb}-${akhir}` };
}

export const kontrol =
  'h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none';

// ---------- Kendali (tanggal / periode) ----------

export function PilihPeriode({
  dari,
  sampai,
  ubah,
}: {
  dari: string;
  sampai: string;
  ubah: (r: { dari: string; sampai: string }) => void;
}) {
  const aktif = (p: Preset) => {
    const r = rentangPreset(p);
    return r.dari === dari && r.sampai === sampai;
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs font-semibold text-gray-600">
        Dari
        <input type="date" value={dari} max={sampai} onChange={(e) => e.target.value && ubah({ dari: e.target.value, sampai })} className={`${kontrol} mt-1 block`} />
      </label>
      <label className="text-xs font-semibold text-gray-600">
        Sampai
        <input type="date" value={sampai} min={dari} onChange={(e) => e.target.value && ubah({ dari, sampai: e.target.value })} className={`${kontrol} mt-1 block`} />
      </label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pilihan periode cepat">
        {PRESET.map((p) => (
          <button
            key={p.kunci}
            type="button"
            aria-pressed={aktif(p.kunci)}
            onClick={() => ubah(rentangPreset(p.kunci))}
            className={`h-9 rounded-lg border px-3 text-xs font-semibold transition ${
              aktif(p.kunci) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Rupiah gaya laporan: negatif dalam kurung. */
export const rpLaporan = (v: number) => (v < 0 ? `(${formatRupiah(-v)})` : formatRupiah(v));

export type Hasil<T> = { ok: true; data: T; json: Record<string, unknown> } | { ok: false; terlarang: boolean; pesan: string };

/** fetch JSON {success,data,message}; 401/403 ditandai terlarang. */
export async function ambil<T>(url: string, init?: RequestInit): Promise<Hasil<T>> {
  try {
    const r = await fetch(url, init);
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) return { ok: false, terlarang: true, pesan: j.message || PESAN_TERLARANG };
    if (!r.ok || !j.success) return { ok: false, terlarang: false, pesan: j.message || 'Gagal memuat data' };
    return { ok: true, data: j.data as T, json: j };
  } catch {
    return { ok: false, terlarang: false, pesan: 'Terjadi kesalahan koneksi' };
  }
}

export const kirimJson = (url: string, body: unknown) =>
  ambil<unknown>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export function KotakTerlarang({ pesan = PESAN_TERLARANG }: { pesan?: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <ShieldAlert className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
      <p className="mt-2 text-sm font-bold text-amber-900">{pesan}</p>
      <p className="text-xs text-amber-700">Akun Anda tidak memiliki akses ke halaman ini.</p>
    </div>
  );
}

export function Toast({ toast }: { toast: { message: string; type: 'success' | 'error' } | null }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      className={`fixed top-5 right-5 z-[60] px-5 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200 print:hidden ${
        toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
      }`}
    >
      {toast.message}
    </div>
  );
}

export interface Akun {
  kode: string;
  nama: string;
  tipe: 'ASET' | 'KEWAJIBAN' | 'EKUITAS' | 'PENDAPATAN' | 'BEBAN';
  saldoNormal: 'D' | 'K';
  kelompok: string;
  arusKas: string | null;
  posting: boolean;
  induk: string | null;
}

export const TIPE_AKUN: Akun['tipe'][] = ['ASET', 'KEWAJIBAN', 'EKUITAS', 'PENDAPATAN', 'BEBAN'];

/** Akun kas yang dipakai form Kas & Bank. */
export const AKUN_KAS = [
  { kode: '1-1100', nama: 'Kas Tunai' },
  { kode: '1-1200', nama: 'Bank' },
  { kode: '1-1300', nama: 'Kas QRIS/E-Wallet' },
];
