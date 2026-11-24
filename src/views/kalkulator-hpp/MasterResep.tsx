'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { formatRupiah } from '@/shared/lib/utils';
import { evaluasiHarga, hitungHpp } from '@/shared/lib/resep-hitung';
import Bingkai from '@/shared/components/ui/Bingkai';

// ============================================================
// Master Resep & HPP Dapur Pusat (docs/PRD-dapur-pusat-franchise.md, F1).
// Resep per batch: hasil, bahan (takaran × harga beli), biaya lain-lain.
// ============================================================

interface BahanResep {
  sku: string;
  namaBahan: string;
  takaran: number;
  jenis: string;
  harga: number;
  subtotal: number;
}

interface Resep {
  produk: { sku: string; namaBarang: string; brand: string | null; hargaBeli: number; hargaFranchise: number; hargaJual: number };
  punyaResep: boolean;
  hasilQty: number;
  catatan: string | null;
  bahan: BahanResep[];
  biaya: { nama: string; jumlah: number }[];
  hpp: { biayaBahan: number; biayaLain: number; hppBatch: number; hppPerUnit: number };
  evaluasi: { marginPusat: number; marginPusatPersen: number; marginFranchise: number; foodCostPersen: number };
}

interface OpsiBahan {
  sku: string;
  namaBarang: string;
  tipeItem: string;
  hargaBeli: number;
}

type Notify = (message: string, type: 'success' | 'error') => void;

export default function MasterResep() {
  const [data, setData] = useState<Resep[]>([]);
  const [bahan, setBahan] = useState<OpsiBahan[]>([]);
  const [loading, setLoading] = useState(true);
  const [versi, setVersi] = useState(0);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Resep | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const notify: Notify = useCallback((message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    let batal = false;
    fetch('/api/fnb/hpp')
      .then((r) => r.json())
      .then((j) => {
        if (batal) return;
        if (j.success) {
          setData(j.data);
          setBahan(j.bahan);
        } else notify(j.message || 'Gagal memuat resep', 'error');
      })
      .catch(() => !batal && notify('Gagal memuat resep', 'error'))
      .finally(() => !batal && setLoading(false));
    return () => {
      batal = true;
    };
  }, [versi, notify]);

  const tampil = useMemo(() => {
    const k = q.trim().toLowerCase();
    return k ? data.filter((d) => `${d.produk.sku} ${d.produk.namaBarang}`.toLowerCase().includes(k)) : data;
  }, [data, q]);

  const denganResep = data.filter((d) => d.punyaResep);
  const rataFoodCost = denganResep.length
    ? Math.round((denganResep.reduce((s, d) => s + d.evaluasi.foodCostPersen, 0) / denganResep.length) * 10) / 10
    : 0;

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
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Master Resep & HPP</h1>
            <p className="text-sm text-gray-500">
              Resep per batch Dapur Pusat: bahan baku, biaya lain-lain, HPP per unit, dan harga jual ke franchise.
            </p>
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

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { judul: 'Produk F&B', nilai: String(data.length), sub: 'Produk jadi & menu' },
          { judul: 'Sudah Punya Resep', nilai: String(denganResep.length), sub: 'Siap diproduksi' },
          { judul: 'Belum Ada Resep', nilai: String(data.length - denganResep.length), sub: 'Belum bisa diproduksi', bahaya: data.length > denganResep.length },
          { judul: 'Rata-rata Food Cost', nilai: `${rataFoodCost}%`, sub: 'HPP ÷ harga jual konsumen' },
        ].map((k) => (
          <div key={k.judul} className={`rounded-2xl border p-4 bg-white ${k.bahaya ? 'border-amber-200' : 'border-gray-200'}`}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{k.judul}</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-gray-900">{k.nilai}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <label className="relative block max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari produk / SKU"
              aria-label="Cari produk"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Produk</th>
                <th className="text-right px-4 py-3">Hasil / Batch</th>
                <th className="text-right px-4 py-3">HPP / Unit</th>
                <th className="text-right px-4 py-3">Harga Franchise</th>
                <th className="text-right px-4 py-3">Harga Jual</th>
                <th className="text-right px-4 py-3">Margin Pusat</th>
                <th className="text-right px-4 py-3">Food Cost</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tampil.map((d) => (
                <tr key={d.produk.sku} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900 leading-tight">{d.produk.namaBarang}</div>
                    <div className="text-[11px] text-gray-500 font-mono mt-0.5">{d.produk.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{d.punyaResep ? `${d.hasilQty} unit` : '-'}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{d.punyaResep ? formatRupiah(d.hpp.hppPerUnit) : '-'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(d.produk.hargaFranchise)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(d.produk.hargaJual)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${d.evaluasi.marginPusat < 0 ? 'text-red-700 font-semibold' : ''}`}>
                    {d.punyaResep ? formatRupiah(d.evaluasi.marginPusat) : '-'}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${d.evaluasi.foodCostPersen > 40 ? 'text-amber-700 font-semibold' : ''}`}>
                    {d.punyaResep && d.produk.hargaJual > 0 ? `${d.evaluasi.foodCostPersen}%` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEdit(d)}
                      className={`h-8 px-3 rounded-lg text-xs font-semibold ${
                        d.punyaResep ? 'border border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-emerald-600 text-white hover:bg-emerald-500'
                      }`}
                    >
                      {d.punyaResep ? 'Ubah Resep' : 'Buat Resep'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && tampil.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500 text-sm">
                    Belum ada produk F&B. Tambahkan produk jadi di Master Barang (divisi F&B).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {edit && (
        <ModalResep
          resep={edit}
          opsiBahan={bahan.filter((b) => b.sku !== edit.produk.sku)}
          onClose={() => setEdit(null)}
          onSaved={(r) => {
            setData((list) => list.map((x) => (x.produk.sku === r.produk.sku ? r : x)));
            setEdit(null);
            notify(`Resep ${r.produk.namaBarang} tersimpan`, 'success');
          }}
          notify={notify}
        />
      )}
    </div>
  );
}

const inputCls = 'w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

function ModalResep({
  resep,
  opsiBahan,
  onClose,
  onSaved,
  notify,
}: {
  resep: Resep;
  opsiBahan: OpsiBahan[];
  onClose: () => void;
  onSaved: (r: Resep) => void;
  notify: Notify;
}) {
  const [hasilQty, setHasilQty] = useState(String(resep.hasilQty || 1));
  const [hargaFranchise, setHargaFranchise] = useState(String(resep.produk.hargaFranchise || ''));
  const [hargaJual, setHargaJual] = useState(String(resep.produk.hargaJual || ''));
  const [catatan, setCatatan] = useState(resep.catatan ?? '');
  const [baris, setBaris] = useState(resep.bahan.map((b) => ({ sku: b.sku, takaran: String(b.takaran), jenis: b.jenis })));
  const [biaya, setBiaya] = useState(
    resep.biaya.length ? resep.biaya.map((b) => ({ nama: b.nama, jumlah: String(b.jumlah) })) : [{ nama: 'Tenaga kerja', jumlah: '' }]
  );
  const [submitting, setSubmitting] = useState(false);

  const hargaOf = (sku: string) => opsiBahan.find((o) => o.sku === sku)?.hargaBeli ?? 0;
  const hpp = hitungHpp(
    Number(hasilQty),
    baris.map((b) => ({ takaran: Number(b.takaran), harga: hargaOf(b.sku) })),
    biaya.map((b) => ({ jumlah: Number(b.jumlah) }))
  );
  const ev = evaluasiHarga(hpp.hppPerUnit, Number(hargaFranchise) || 0, Number(hargaJual) || 0);

  const simpan = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/fnb/hpp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuSku: resep.produk.sku,
          hasilQty: Number(hasilQty),
          catatan,
          bahan: baris.filter((b) => b.sku).map((b) => ({ sku: b.sku, takaran: Number(b.takaran), jenis: b.jenis })),
          biaya: biaya.filter((b) => b.nama.trim() || Number(b.jumlah) > 0).map((b) => ({ nama: b.nama, jumlah: Number(b.jumlah) || 0 })),
          hargaFranchise: Number(hargaFranchise) || 0,
          hargaJual: Number(hargaJual) || 0,
        }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.message);
      onSaved(j.data);
    } catch (e) {
      notify(e instanceof Error && e.message ? e.message : 'Gagal menyimpan resep', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Bingkai judul={`Resep: ${resep.produk.namaBarang}`} sub={`${resep.produk.sku} · takaran per batch dalam satuan stok bahan`} onClose={onClose} lebar="max-w-5xl">
      <div className="flex-1 overflow-y-auto p-5 sm:px-8 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-xs font-semibold text-gray-700 space-y-1">
            <span>Hasil per batch (unit)</span>
            <input type="number" min={1} step={1} value={hasilQty} onChange={(e) => setHasilQty(e.target.value)} className={inputCls} />
          </label>
          <label className="text-xs font-semibold text-gray-700 space-y-1">
            <span>Harga ke franchise / unit</span>
            <input type="number" min={0} value={hargaFranchise} onChange={(e) => setHargaFranchise(e.target.value)} className={inputCls} />
          </label>
          <label className="text-xs font-semibold text-gray-700 space-y-1">
            <span>Harga jual konsumen / unit</span>
            <input type="number" min={0} value={hargaJual} onChange={(e) => setHargaJual(e.target.value)} className={inputCls} />
          </label>
          <label className="text-xs font-semibold text-gray-700 space-y-1">
            <span>Catatan</span>
            <input value={catatan} onChange={(e) => setCatatan(e.target.value)} className={inputCls} placeholder="Opsional" />
          </label>
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Bahan Baku & Kemasan per Batch</h3>
            <button
              type="button"
              onClick={() => setBaris((b) => [...b, { sku: '', takaran: '', jenis: 'bahan' }])}
              className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah bahan
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="text-left py-2">Bahan</th>
                  <th className="text-right py-2 w-28">Takaran</th>
                  <th className="text-left py-2 w-28 pl-3">Jenis</th>
                  <th className="text-right py-2 w-28">Harga / satuan</th>
                  <th className="text-right py-2 w-32">Subtotal</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {baris.map((b, i) => {
                  const ubah = (v: Partial<typeof b>) => setBaris((list) => list.map((x, j) => (j === i ? { ...x, ...v } : x)));
                  return (
                    <tr key={i}>
                      <td className="py-2 pr-2">
                        <select value={b.sku} onChange={(e) => ubah({ sku: e.target.value })} className={inputCls} aria-label="Pilih bahan">
                          <option value="">Pilih bahan</option>
                          {opsiBahan.map((o) => (
                            <option key={o.sku} value={o.sku}>
                              {o.namaBarang} ({o.sku})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2">
                        <input type="number" min={0} step="any" value={b.takaran} onChange={(e) => ubah({ takaran: e.target.value })} className={`${inputCls} text-right`} aria-label="Takaran" />
                      </td>
                      <td className="py-2 pl-3">
                        <select value={b.jenis} onChange={(e) => ubah({ jenis: e.target.value })} className={inputCls} aria-label="Jenis">
                          <option value="bahan">Bahan</option>
                          <option value="kemasan">Kemasan</option>
                        </select>
                      </td>
                      <td className="py-2 text-right tabular-nums text-gray-600">{formatRupiah(hargaOf(b.sku))}</td>
                      <td className="py-2 text-right tabular-nums font-semibold">{formatRupiah((Number(b.takaran) || 0) * hargaOf(b.sku))}</td>
                      <td className="py-2 text-right">
                        <button type="button" aria-label="Hapus bahan" onClick={() => setBaris((list) => list.filter((_, j) => j !== i))} className="w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center justify-center">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {baris.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-xs text-gray-500">Belum ada bahan.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Biaya Lain-lain per Batch</h3>
            <button
              type="button"
              onClick={() => setBiaya((b) => [...b, { nama: '', jumlah: '' }])}
              className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah biaya
            </button>
          </div>
          {biaya.map((b, i) => {
            const ubah = (v: Partial<typeof b>) => setBiaya((list) => list.map((x, j) => (j === i ? { ...x, ...v } : x)));
            return (
              <div key={i} className="flex items-center gap-2">
                <input value={b.nama} onChange={(e) => ubah({ nama: e.target.value })} placeholder="Tenaga kerja, gas, listrik, ..." className={inputCls} aria-label="Nama biaya" />
                <input type="number" min={0} value={b.jumlah} onChange={(e) => ubah({ jumlah: e.target.value })} placeholder="Rp" className={`${inputCls} max-w-[160px] text-right`} aria-label="Jumlah biaya" />
                <button type="button" aria-label="Hapus biaya" onClick={() => setBiaya((list) => list.filter((_, j) => j !== i))} className="w-10 h-10 shrink-0 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </section>

        <section className="rounded-xl bg-gray-50 border border-gray-100 p-4 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {[
            ['Biaya bahan / batch', formatRupiah(hpp.biayaBahan)],
            ['Biaya lain / batch', formatRupiah(hpp.biayaLain)],
            ['HPP / batch', formatRupiah(hpp.hppBatch)],
            ['HPP / unit', formatRupiah(hpp.hppPerUnit)],
            ['Margin Dapur Pusat / unit', `${formatRupiah(ev.marginPusat)} (${ev.marginPusatPersen}%)`],
            ['Margin franchise / unit', formatRupiah(ev.marginFranchise)],
            ['Food cost', `${ev.foodCostPersen}%`],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-gray-500">{k}</div>
              <div className={`font-bold tabular-nums ${k.startsWith('Margin Dapur') && ev.marginPusat < 0 ? 'text-red-700' : 'text-gray-900'}`}>{v}</div>
            </div>
          ))}
        </section>
      </div>
      <div className="px-5 sm:px-8 py-4 border-t border-gray-100 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Batal
        </button>
        <button
          type="button"
          onClick={simpan}
          disabled={submitting}
          className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
        >
          {submitting ? 'Menyimpan...' : 'Simpan Resep'}
        </button>
      </div>
    </Bingkai>
  );
}
