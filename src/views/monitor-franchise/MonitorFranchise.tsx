'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Store } from 'lucide-react';
import { formatRupiah } from '@/shared/lib/utils';

// ============================================================
// Monitor Franchise (docs/PRD-dapur-pusat-franchise.md, F4):
// omset POS, stok, pembelian ke Dapur Pusat, dan tagihan per outlet.
// ============================================================

interface Outlet {
  nama: string;
  kode: string;
  status: string;
  omset: number;
  transaksi: number;
  qtyTerjual: number;
  terlaris: { namaBarang: string; qty: number; omset: number }[];
  nilaiStok: number;
  itemStok: number;
  pembelian: number;
  sisaTagihan: number;
  orderMenunggu: number;
}

interface Total {
  omset: number;
  transaksi: number;
  nilaiStok: number;
  pembelian: number;
  sisaTagihan: number;
  orderMenunggu: number;
}

const tgl = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inputCls = 'h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

export default function MonitorFranchise() {
  const sekarang = new Date();
  const [dari, setDari] = useState(tgl(new Date(sekarang.getFullYear(), sekarang.getMonth(), 1)));
  const [sampai, setSampai] = useState(tgl(sekarang));
  const [outlet, setOutlet] = useState<Outlet[]>([]);
  const [total, setTotal] = useState<Total | null>(null);
  const [loading, setLoading] = useState(true);
  const [versi, setVersi] = useState(0);
  const [error, setError] = useState('');

  const muat = useCallback(() => {
    setLoading(true);
    setVersi((v) => v + 1);
  }, []);

  useEffect(() => {
    let batal = false;
    fetch(`/api/franchise/monitor?dari=${dari}&sampai=${sampai}`)
      .then((r) => r.json())
      .then((j) => {
        if (batal) return;
        if (j.success) {
          setOutlet(j.data.outlet);
          setTotal(j.data.total);
          setError('');
        } else setError(j.message || 'Gagal memuat data');
      })
      .catch(() => !batal && setError('Gagal memuat data'))
      .finally(() => !batal && setLoading(false));
    return () => {
      batal = true;
    };
  }, [dari, sampai, versi]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Monitor Franchise</h1>
            <p className="text-sm text-gray-500">Penjualan POS, stok, pembelian ke Dapur Pusat, dan tagihan setiap outlet franchise.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-gray-700 space-y-1">
            <span className="block">Dari</span>
            <input type="date" value={dari} max={sampai} onChange={(e) => setDari(e.target.value)} className={inputCls} />
          </label>
          <label className="text-xs font-semibold text-gray-700 space-y-1">
            <span className="block">Sampai</span>
            <input type="date" value={sampai} min={dari} onChange={(e) => setSampai(e.target.value)} className={inputCls} />
          </label>
          <button
            type="button"
            onClick={muat}
            aria-label="Muat ulang"
            className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 flex items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3">{error}</p>}

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { judul: 'Omset POS Franchise', nilai: formatRupiah(total?.omset ?? 0), sub: `${total?.transaksi ?? 0} transaksi` },
          { judul: 'Pembelian ke Pusat', nilai: formatRupiah(total?.pembelian ?? 0), sub: 'Order dikirim pada periode' },
          { judul: 'Sisa Tagihan', nilai: formatRupiah(total?.sisaTagihan ?? 0), sub: 'Piutang semua franchise', bahaya: (total?.sisaTagihan ?? 0) > 0 },
          { judul: 'Nilai Stok Outlet', nilai: formatRupiah(total?.nilaiStok ?? 0), sub: 'Stok × harga franchise' },
          { judul: 'Order Menunggu', nilai: String(total?.orderMenunggu ?? 0), sub: 'Belum dikirim Dapur Pusat' },
        ].map((k) => (
          <div key={k.judul} className={`rounded-2xl border p-4 bg-white ${k.bahaya ? 'border-amber-200' : 'border-gray-200'}`}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{k.judul}</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-gray-900">{k.nilai}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Outlet</th>
                <th className="text-right px-4 py-3">Omset POS</th>
                <th className="text-right px-4 py-3">Transaksi</th>
                <th className="text-left px-4 py-3">Terlaris</th>
                <th className="text-right px-4 py-3">Nilai Stok</th>
                <th className="text-right px-4 py-3">Pembelian</th>
                <th className="text-right px-4 py-3">Sisa Tagihan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {outlet.map((o) => (
                <tr key={o.nama} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{o.nama}</div>
                    <div className="text-[11px] text-gray-500 font-mono">
                      {o.kode}
                      {o.status !== 'ACTIVE' ? ' · nonaktif' : ''}
                      {o.orderMenunggu ? ` · ${o.orderMenunggu} order menunggu` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatRupiah(o.omset)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{o.transaksi}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {o.terlaris.length ? o.terlaris.map((t) => `${t.namaBarang} (${t.qty})`).join(', ') : '-'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(o.nilaiStok)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(o.pembelian)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${o.sisaTagihan > 0 ? 'text-red-700 font-semibold' : ''}`}>
                    {formatRupiah(o.sisaTagihan)}
                  </td>
                </tr>
              ))}
              {!loading && outlet.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    Belum ada outlet franchise. Tambahkan di Manajemen Cabang dengan tipe Franchise.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
