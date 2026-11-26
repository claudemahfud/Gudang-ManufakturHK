'use client';

import { Plus, Trash2 } from 'lucide-react';
import { formatRupiah } from '@/shared/lib/utils';
import { kontrol } from '@/views/laporan-keuangan/util';
import { AKUN_BIAYA_SALES, MAKS_BARIS_BIAYA, namaAkunBiaya, type BiayaSetoran } from '@/shared/lib/biaya-sales';

export interface BarisBiaya {
  akun: string;
  jumlah: string;
  keterangan: string;
}

export function DaftarBiaya({ biaya }: { biaya: BiayaSetoran[] }) {
  return (
    <ul className="mt-1 space-y-0.5">
      {biaya.map((b, i) => (
        <li key={i}>
          {namaAkunBiaya(b.akun)}: <strong className="tabular-nums">{formatRupiah(b.jumlah)}</strong> ({b.keterangan})
        </li>
      ))}
    </ul>
  );
}

export function InputBiaya({ biaya, onChange }: { biaya: BarisBiaya[]; onChange: (b: BarisBiaya[]) => void }) {
  const ubah = (i: number, v: Partial<BarisBiaya>) => onChange(biaya.map((b, j) => (j === i ? { ...b, ...v } : b)));
  return (
    <fieldset className="space-y-2">
      <legend className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Biaya operasional sales</legend>
      <p className="text-[11px] text-gray-500">Hanya biaya yang dibayar memakai uang penjualan ini.</p>
      {biaya.map((b, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-gray-200 p-2">
          <select aria-label={`Jenis biaya ${i + 1}`} value={b.akun} onChange={(e) => ubah(i, { akun: e.target.value })} className={`${kontrol} w-full`}>
            {AKUN_BIAYA_SALES.map((a) => (
              <option key={a.kode} value={a.kode}>{a.nama}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <input type="number" min="0" step="any" inputMode="decimal" aria-label={`Nominal biaya ${i + 1}`} placeholder="Nominal" value={b.jumlah} onChange={(e) => ubah(i, { jumlah: e.target.value })} className={`${kontrol} w-32 font-semibold`} />
            <input aria-label={`Keterangan biaya ${i + 1}`} placeholder="Keterangan / bukti" maxLength={200} value={b.keterangan} onChange={(e) => ubah(i, { keterangan: e.target.value })} className={`${kontrol} min-w-0 flex-1`} />
            <button type="button" aria-label={`Hapus biaya ${i + 1}`} onClick={() => onChange(biaya.filter((_, j) => j !== i))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
      <button type="button" disabled={biaya.length >= MAKS_BARIS_BIAYA} onClick={() => onChange([...biaya, { akun: AKUN_BIAYA_SALES[0].kode, jumlah: '', keterangan: '' }])} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Tambah biaya
      </button>
    </fieldset>
  );
}
