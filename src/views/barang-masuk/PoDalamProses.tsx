'use client';

// ============================================================
// PO Dalam Proses -> "Barang Datang" -> Faktur Pembelian
// PO (status Proses / Datang Sebagian) dikonversi menjadi Faktur Pembelian.
// Qty & harga bisa direvisi sesuai barang yang benar-benar datang.
// Submit = stok masuk. Lalu ditanya: ada barang cacat/rusak? -> formulir Return.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, PackageCheck, RefreshCw, Truck, X } from 'lucide-react';
import { formatRupiah, formatTanggal } from '@/shared/lib/utils';
import { useDivision } from '@/shared/context/DivisionContext';
import { ROUTES } from '@/router/routes';
import { PO_STATUS, PO_STATUS_LABEL } from '@/shared/lib/po-status';

interface PoItem {
  id: string;
  sku: string;
  namaBarang: string;
  qtyOrder: number;
  qtyTerima: number;
  satuan: string;
}

interface PoTerbuka {
  id: string;
  noPo: string;
  tanggal: string;
  supplier: string | null;
  armada: string | null;
  status: string;
  cabang: string;
  items: PoItem[];
}

interface FakturRow {
  itemId: string;
  sku: string;
  namaBarang: string;
  satuan: string;
  sisa: number;
  qtyTerima: string;
  hargaBeli: string;
}

interface Hasil {
  noPo: string;
  supplier: string;
  noFaktur: string | null;
  status: string;
  items: { sku: string; namaBarang: string }[];
}

type Notify = (type: 'success' | 'error', message: string, penyebab?: string) => void;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function PoDalamProses({ onReceived, notify }: { onReceived: () => void; notify: Notify }) {
  const router = useRouter();
  const { division } = useDivision();
  const [list, setList] = useState<PoTerbuka[]>([]);
  const [loading, setLoading] = useState(true);
  const [hargaMaster, setHargaMaster] = useState<Record<string, number | null>>({});
  const [bolehHpp, setBolehHpp] = useState(false);

  // Faktur yang sedang diisi
  const [po, setPo] = useState<PoTerbuka | null>(null);
  const [rows, setRows] = useState<FakturRow[]>([]);
  const [noFaktur, setNoFaktur] = useState('');
  const [tanggal, setTanggal] = useState(today());
  const [skemaBayar, setSkemaBayar] = useState<'lunas' | 'hutang'>('hutang');
  const [jatuhTempo, setJatuhTempo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);

  // notify dari induk dibuat ulang tiap render: simpan di ref agar load tidak berubah-ubah
  const notifyRef = useRef(notify);
  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  const load = useCallback(
    () =>
      Promise.all([
        fetch('/api/po-loading?terbuka=1').then((r) => r.json()),
        fetch('/api/inventory?limit=1000').then((r) => r.json()),
      ])
        .then(([poRes, invRes]) => {
          if (poRes.success) setList(poRes.data || []);
          if (invRes.success) {
            const map: Record<string, number | null> = {};
            let visible = false;
            for (const it of invRes.data || []) {
              map[it.sku] = it.hargaBeli === null || it.hargaBeli === undefined ? null : Number(it.hargaBeli);
              if (it.hargaBeli !== null && it.hargaBeli !== undefined) visible = true;
            }
            setHargaMaster(map);
            // HPP disembunyikan server untuk role yang tidak berhak: kolom harga hanya baca
            setBolehHpp(visible);
          }
        })
        .catch(() => notifyRef.current('error', 'Gagal memuat daftar PO dalam proses'))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const bukaFaktur = (p: PoTerbuka) => {
    setPo(p);
    setNoFaktur('');
    setTanggal(today());
    setSkemaBayar('hutang');
    setJatuhTempo('');
    setRows(
      p.items
        .map((it) => ({
          itemId: it.id,
          sku: it.sku,
          namaBarang: it.namaBarang,
          satuan: it.satuan,
          sisa: it.qtyOrder - it.qtyTerima,
          qtyTerima: String(it.qtyOrder - it.qtyTerima),
          hargaBeli: String(hargaMaster[it.sku.trim().toUpperCase()] ?? hargaMaster[it.sku] ?? ''),
        }))
        .filter((r) => r.sisa > 0)
    );
  };

  const setRow = (i: number, patch: Partial<FakturRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const total = rows.reduce((s, r) => s + (Number(r.qtyTerima) || 0) * (Number(r.hargaBeli) || 0), 0);
  const adaQty = rows.some((r) => Number(r.qtyTerima) > 0);
  const qtyInvalid = rows.some((r) => {
    const q = Number(r.qtyTerima);
    return !Number.isInteger(q) || q < 0 || q > r.sisa;
  });

  const submit = async () => {
    if (!po || !adaQty || qtyInvalid) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/po-loading/${po.id}/faktur`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noFaktur,
          tanggal,
          skemaBayar,
          jatuhTempo: skemaBayar === 'hutang' && jatuhTempo ? jatuhTempo : undefined,
          divisi: division,
          items: rows.map((r) => ({
            itemId: r.itemId,
            qtyTerima: Number(r.qtyTerima) || 0,
            ...(bolehHpp && r.hargaBeli !== '' && { hargaBeli: Number(r.hargaBeli) }),
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        notify('error', json.message || 'Gagal menyimpan faktur pembelian');
        return;
      }
      setPo(null);
      setHasil(json.data);
      notify(
        'success',
        `Faktur pembelian ${json.data.noFaktur || json.data.noPo} tersimpan. Stok sudah bertambah.`,
        json.data.status === PO_STATUS.SEBAGIAN ? 'Sebagian barang belum datang: PO tetap ada di daftar ini.' : undefined
      );
      load();
      onReceived();
    } catch {
      notify('error', 'Terjadi kesalahan koneksi saat menyimpan faktur');
    } finally {
      setSubmitting(false);
    }
  };

  const keFormReturn = () => {
    if (!hasil) return;
    const q = new URLSearchParams({
      returFaktur: hasil.noFaktur || hasil.noPo,
      supplier: hasil.supplier,
      skus: hasil.items.map((i) => i.sku).join(','),
    });
    setHasil(null);
    router.push(`${ROUTES.LAPORAN_RUSAK_RETUR}?${q.toString()}`);
  };

  const input =
    'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none';

  return (
    <section aria-label="PO Dalam Proses" className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-gray-800">PO Dalam Proses</h2>
          <span className="text-xs text-gray-400">({list.length})</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            load();
          }}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          aria-label="Muat ulang daftar PO"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && list.length === 0 ? (
        <div className="p-6 text-center text-xs text-gray-400">Memuat PO...</div>
      ) : list.length === 0 ? (
        <div className="p-6 text-center text-xs text-gray-400">
          Tidak ada PO yang menunggu barang datang. Buat PO di menu PO Loading.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">No. PO</th>
                <th className="py-2.5 px-4">Tanggal</th>
                <th className="py-2.5 px-4">Suplier</th>
                <th className="py-2.5 px-4">Cabang</th>
                <th className="py-2.5 px-4 text-center">Barang (datang / pesan)</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((p) => {
                const pesan = p.items.reduce((s, i) => s + i.qtyOrder, 0);
                const datang = p.items.reduce((s, i) => s + i.qtyTerima, 0);
                return (
                  <tr key={p.id} className="hover:bg-gray-50/60">
                    <td className="py-2.5 px-4 font-mono font-semibold text-gray-800">{p.noPo}</td>
                    <td className="py-2.5 px-4 text-gray-600">{formatTanggal(p.tanggal)}</td>
                    <td className="py-2.5 px-4 font-semibold text-gray-800">{p.supplier || '-'}</td>
                    <td className="py-2.5 px-4 text-gray-600">{p.cabang}</td>
                    <td className="py-2.5 px-4 text-center tabular-nums text-gray-700">
                      {p.items.length} item · {datang}/{pesan}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold ${
                          p.status === PO_STATUS.SEBAGIAN ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {PO_STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => bukaFaktur(p)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        Barang Datang
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Faktur Pembelian (konversi dari PO) */}
      {po && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="faktur-title"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-gray-100"
          >
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100">
              <div>
                <h3 id="faktur-title" className="text-lg font-bold text-gray-900">
                  Faktur Pembelian
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Dari <span className="font-mono font-semibold">{po.noPo}</span> · {po.supplier} · Cabang {po.cabang}.
                  Sesuaikan jumlah dengan barang yang benar-benar datang.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPo(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <label className="block text-xs font-semibold text-gray-700">
                  No. Faktur Suplier
                  <input
                    value={noFaktur}
                    onChange={(e) => setNoFaktur(e.target.value)}
                    placeholder={`Kosong = ${po.noPo}`}
                    className={`${input} mt-1 font-normal`}
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-700">
                  Tanggal Terima
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className={`${input} mt-1 font-normal`}
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-700">
                  Skema Bayar
                  <select
                    value={skemaBayar}
                    onChange={(e) => setSkemaBayar(e.target.value as 'lunas' | 'hutang')}
                    className={`${input} mt-1 font-normal bg-white`}
                  >
                    <option value="hutang">Hutang (Tempo)</option>
                    <option value="lunas">Lunas (Tunai)</option>
                  </select>
                </label>
                {skemaBayar === 'hutang' && (
                  <label className="block text-xs font-semibold text-gray-700">
                    Jatuh Tempo
                    <input
                      type="date"
                      value={jatuhTempo}
                      onChange={(e) => setJatuhTempo(e.target.value)}
                      className={`${input} mt-1 font-normal`}
                    />
                    <span className="text-[10px] font-normal text-gray-400">Kosong = 30 hari</span>
                  </label>
                )}
              </div>

              <div className="border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-semibold">
                    <tr>
                      <th className="p-2.5">Barang</th>
                      <th className="p-2.5 text-center">Sisa Pesanan</th>
                      <th className="p-2.5 text-center w-28">Qty Datang</th>
                      <th className="p-2.5 text-right w-36">Harga Beli</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((r, i) => {
                      const q = Number(r.qtyTerima);
                      const salah = !Number.isInteger(q) || q < 0 || q > r.sisa;
                      return (
                        <tr key={r.itemId}>
                          <td className="p-2.5">
                            <div className="font-semibold text-gray-800">{r.namaBarang}</div>
                            <div className="text-[10px] font-mono text-gray-400">{r.sku}</div>
                          </td>
                          <td className="p-2.5 text-center tabular-nums text-gray-600">
                            {r.sisa} {r.satuan}
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              min={0}
                              max={r.sisa}
                              value={r.qtyTerima}
                              onChange={(e) => setRow(i, { qtyTerima: e.target.value })}
                              aria-invalid={salah}
                              aria-label={`Qty datang ${r.namaBarang}`}
                              className={`w-full px-2 py-1.5 rounded-lg border text-center tabular-nums font-semibold outline-none ${
                                salah ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-emerald-500'
                              }`}
                            />
                            {salah && <div className="text-[10px] text-red-600 mt-0.5">0 – {r.sisa}</div>}
                          </td>
                          <td className="p-2.5 text-right">
                            {bolehHpp ? (
                              <input
                                type="number"
                                min={0}
                                value={r.hargaBeli}
                                onChange={(e) => setRow(i, { hargaBeli: e.target.value })}
                                aria-label={`Harga beli ${r.namaBarang}`}
                                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-right tabular-nums outline-none focus:border-emerald-500"
                              />
                            ) : (
                              <span className="text-gray-400">Harga master</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right tabular-nums font-semibold text-gray-800">
                            {bolehHpp ? formatRupiah((Number(r.qtyTerima) || 0) * (Number(r.hargaBeli) || 0)) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-gray-500">
                Barang yang belum datang isi 0. Sisanya tetap menunggu di PO ini dan bisa diterima nanti.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
              <div className="text-sm text-gray-600">
                {bolehHpp && (
                  <>
                    Total: <strong className="text-gray-900 tabular-nums">{formatRupiah(total)}</strong>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPo(null)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || !adaQty || qtyInvalid}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold"
                >
                  {submitting ? 'Menyimpan...' : 'Submit Faktur Pembelian'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up setelah submit: ada barang cacat / rusak? */}
      {hasil && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cacat-title"
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-4 border border-gray-100"
          >
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h3 id="cacat-title" className="text-lg font-bold text-gray-900">
                Apakah ada barang cacat / rusak?
              </h3>
              <p className="text-xs text-gray-500 mt-1.5">
                Faktur {hasil.noFaktur || hasil.noPo} dari {hasil.supplier} sudah masuk stok. Jika ada yang cacat atau
                rusak, catat di formulir Return agar stok dikoreksi.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setHasil(null)}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold whitespace-nowrap hover:bg-gray-50"
              >
                Tidak, Tutup
              </button>
              <button
                type="button"
                onClick={keFormReturn}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold whitespace-nowrap"
              >
                Ya, Isi Formulir Return
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
