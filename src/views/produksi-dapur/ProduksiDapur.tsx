'use client';

import { useCallback, useEffect, useState } from 'react';
import { CookingPot, RefreshCw } from 'lucide-react';
import { formatRupiah, formatTanggalWaktu } from '@/shared/lib/utils';
import { pemakaianBahan } from '@/shared/lib/resep-hitung';

// ============================================================
// Produksi Dapur Pusat (docs/PRD-dapur-pusat-franchise.md, F2):
// potong bahan dari stok Pusat, tambah produk jadi, simpan jejak HPP.
// ============================================================

interface ResepRingkas {
  produk: { sku: string; namaBarang: string };
  punyaResep: boolean;
  hasilQty: number;
  bahan: { sku: string; namaBahan: string; takaran: number; harga: number; stokPusat: number }[];
  hpp: { biayaLain: number; hppPerUnit: number };
}

interface Produksi {
  id: string;
  noProduksi: string;
  tanggal: string;
  namaBarang: string;
  jumlahBatch: number;
  hasilQty: number;
  biayaBahan: string;
  biayaLain: string;
  hppTotal: string;
  hppPerUnit: string;
  createdBy: string | null;
  bahan: { bahanSku: string; namaBahan: string; qty: number }[];
}

const inputCls = 'w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

export default function ProduksiDapur() {
  const [resep, setResep] = useState<ResepRingkas[]>([]);
  const [riwayat, setRiwayat] = useState<Produksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [versi, setVersi] = useState(0);
  const [sku, setSku] = useState('');
  const [batch, setBatch] = useState('1');
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    let batal = false;
    Promise.all([fetch('/api/fnb/hpp').then((r) => r.json()), fetch('/api/fnb/produksi').then((r) => r.json())])
      .then(([r, p]) => {
        if (batal) return;
        if (r.success) setResep(r.data.filter((x: ResepRingkas) => x.punyaResep));
        else notify(r.message || 'Gagal memuat resep', 'error');
        if (p.success) setRiwayat(p.data);
      })
      .catch(() => !batal && notify('Gagal memuat data produksi', 'error'))
      .finally(() => !batal && setLoading(false));
    return () => {
      batal = true;
    };
  }, [versi, notify]);

  const pilih = resep.find((r) => r.produk.sku === sku);
  const n = Math.max(0, Math.floor(Number(batch) || 0));
  const pemakaian = pilih?.bahan.map((b) => ({ ...b, qty: pemakaianBahan(b.takaran, n) })) ?? [];
  const kurang = pemakaian.filter((b) => b.qty > b.stokPusat);
  const estimasi = pemakaian.reduce((s, b) => s + b.qty * b.harga, 0) + (pilih?.hpp.biayaLain ?? 0) * n;

  const simpan = async () => {
    if (submitting || !pilih || n < 1) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/fnb/produksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuSku: sku, jumlahBatch: n, catatan }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.message);
      notify(j.message, 'success');
      setCatatan('');
      setLoading(true);
      setVersi((v) => v + 1);
    } catch (e) {
      notify(e instanceof Error && e.message ? e.message : 'Produksi gagal', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          role="status"
          className={`fixed top-5 right-5 z-[60] px-5 py-3 rounded-xl shadow-lg border text-sm font-medium ${
            toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <CookingPot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Produksi Dapur Pusat</h1>
            <p className="text-sm text-gray-500">Masak per batch dari Master Resep. Bahan dipotong dari stok Pusat, produk jadi masuk stok Pusat.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setVersi((v) => v + 1);
          }}
          className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Muat ulang
        </button>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-900">Produksi Baru</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs font-semibold text-gray-700 space-y-1 sm:col-span-1">
            <span>Produk</span>
            <select value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls}>
              <option value="">{resep.length ? 'Pilih produk' : 'Belum ada resep'}</option>
              {resep.map((r) => (
                <option key={r.produk.sku} value={r.produk.sku}>
                  {r.produk.namaBarang} ({r.hasilQty} unit/batch)
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-700 space-y-1">
            <span>Jumlah batch</span>
            <input type="number" min={1} step={1} value={batch} onChange={(e) => setBatch(e.target.value)} className={inputCls} />
          </label>
          <label className="text-xs font-semibold text-gray-700 space-y-1">
            <span>Catatan</span>
            <input value={catatan} onChange={(e) => setCatatan(e.target.value)} className={inputCls} placeholder="Opsional" />
          </label>
        </div>

        {pilih && n > 0 && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>
                Hasil: <strong className="tabular-nums">{pilih.hasilQty * n} unit</strong>
              </span>
              <span>
                Estimasi HPP: <strong className="tabular-nums">{formatRupiah(estimasi)}</strong> ({formatRupiah(estimasi / (pilih.hasilQty * n))}/unit)
              </span>
            </div>
            <table className="w-full text-xs">
              <thead className="text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="text-left py-1">Bahan</th>
                  <th className="text-right py-1">Dipakai</th>
                  <th className="text-right py-1">Stok Pusat</th>
                </tr>
              </thead>
              <tbody>
                {pemakaian.map((b) => (
                  <tr key={b.sku} className={b.qty > b.stokPusat ? 'text-red-700 font-semibold' : 'text-gray-800'}>
                    <td className="py-1">{b.namaBahan}</td>
                    <td className="py-1 text-right tabular-nums">{b.qty}</td>
                    <td className="py-1 text-right tabular-nums">{b.stokPusat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {kurang.length > 0 && <p className="text-xs text-red-700 font-semibold">Stok bahan tidak cukup: {kurang.map((k) => k.namaBahan).join(', ')}.</p>}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={simpan}
            disabled={submitting || !pilih || n < 1 || kurang.length > 0}
            className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
          >
            {submitting ? 'Memproses...' : 'Simpan Produksi'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 text-sm font-bold text-gray-900">Riwayat Produksi</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">No / Waktu</th>
                <th className="text-left px-4 py-3">Produk</th>
                <th className="text-right px-4 py-3">Batch</th>
                <th className="text-right px-4 py-3">Hasil</th>
                <th className="text-right px-4 py-3">HPP Total</th>
                <th className="text-right px-4 py-3">HPP / Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {riwayat.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs font-semibold text-gray-900">{p.noProduksi}</div>
                    <div className="text-[11px] text-gray-500">{formatTanggalWaktu(p.tanggal)} · {p.createdBy}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{p.namaBarang}</div>
                    <div className="text-[11px] text-gray-500">{p.bahan.map((b) => `${b.namaBahan} ${b.qty}`).join(', ')}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.jumlahBatch}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.hasilQty}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(p.hppTotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatRupiah(p.hppPerUnit)}</td>
                </tr>
              ))}
              {!loading && riwayat.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">Belum ada produksi.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
