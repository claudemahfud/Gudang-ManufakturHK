'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PackageCheck, Plus, RefreshCw, Store, Truck, XCircle } from 'lucide-react';
import { formatRupiah, formatTanggalWaktu } from '@/shared/lib/utils';
import Bingkai from '@/shared/components/ui/Bingkai';

// ============================================================
// Order Franchise ke Dapur Pusat (docs/PRD-dapur-pusat-franchise.md, F3).
// Franchise: buat order, batalkan, terima barang. Pusat: kirim (faktur tempo), tolak, batal kirim.
// ============================================================

type Status = 'diajukan' | 'dikirim' | 'diterima' | 'ditolak' | 'dibatalkan';

interface Order {
  id: string;
  noOrder: string;
  tanggal: string;
  franchise: string;
  status: Status;
  total: string;
  noFaktur: string | null;
  catatan: string | null;
  alasan: string | null;
  createdBy: string | null;
  items: { id: string; sku: string; namaBarang: string; qty: number; harga: string; subtotal: string }[];
  tagihan: { sisaPiutang: string; status: string; jatuhTempo: string | null } | null;
}

interface Katalog {
  sku: string;
  namaBarang: string;
  brand: string | null;
  hargaFranchise: number;
  stokPusat: number;
}

type Notify = (message: string, type: 'success' | 'error') => void;

const LABEL: Record<Status, { teks: string; cls: string }> = {
  diajukan: { teks: 'Menunggu Dapur Pusat', cls: 'bg-amber-50 text-amber-800' },
  dikirim: { teks: 'Dikirim', cls: 'bg-blue-50 text-blue-800' },
  diterima: { teks: 'Diterima', cls: 'bg-emerald-50 text-emerald-800' },
  ditolak: { teks: 'Ditolak', cls: 'bg-red-50 text-red-700' },
  dibatalkan: { teks: 'Dibatalkan', cls: 'bg-gray-100 text-gray-600' },
};

const inputCls = 'w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';

async function aksiOrder(id: string, body: object) {
  const res = await fetch(`/api/franchise/order/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default function OrderFranchise() {
  const [data, setData] = useState<Order[]>([]);
  const [katalog, setKatalog] = useState<Katalog[]>([]);
  const [lingkup, setLingkup] = useState<string | null>(null);
  const [outlet, setOutlet] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [versi, setVersi] = useState(0);
  const [filter, setFilter] = useState<Status | 'semua'>('semua');
  const [buka, setBuka] = useState<string | null>(null);
  const [modal, setModal] = useState<{ jenis: 'buat' } | { jenis: 'kirim' | 'batal'; order: Order } | null>(null);
  const [proses, setProses] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const notify: Notify = useCallback((message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const muatUlang = () => {
    setLoading(true);
    setVersi((v) => v + 1);
  };

  useEffect(() => {
    let batal = false;
    Promise.all([fetch('/api/franchise/order').then((r) => r.json()), fetch('/api/cabang').then((r) => r.json())])
      .then(([o, c]) => {
        if (batal) return;
        if (o.success) {
          setData(o.data);
          setKatalog(o.katalog);
          setLingkup(o.lingkup);
        } else notify(o.message || 'Gagal memuat order', 'error');
        if (c.success) setOutlet(c.data.filter((x: { tipe?: string }) => x.tipe === 'FRANCHISE').map((x: { namaCabang: string }) => x.namaCabang));
      })
      .catch(() => !batal && notify('Gagal memuat order', 'error'))
      .finally(() => !batal && setLoading(false));
    return () => {
      batal = true;
    };
  }, [versi, notify]);

  const pusat = lingkup === null;
  const hitung = useMemo(() => {
    const h: Record<string, number> = {};
    for (const o of data) h[o.status] = (h[o.status] ?? 0) + 1;
    return h;
  }, [data]);
  const tampil = filter === 'semua' ? data : data.filter((o) => o.status === filter);
  const sisaTagihan = data.reduce((s, o) => s + Number(o.tagihan?.sisaPiutang ?? 0), 0);

  const terima = async (o: Order) => {
    if (proses) return;
    setProses(o.id);
    try {
      const j = await aksiOrder(o.id, { aksi: 'terima' });
      if (!j.success) throw new Error(j.message);
      notify(`Order ${o.noOrder} diterima, stok outlet bertambah`, 'success');
      muatUlang();
    } catch (e) {
      notify(e instanceof Error && e.message ? e.message : 'Gagal menerima order', 'error');
    } finally {
      setProses(null);
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
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Order Franchise</h1>
            <p className="text-sm text-gray-500">
              {pusat
                ? 'Order produk dari outlet franchise. Kirim untuk menerbitkan faktur tempo dan memotong stok Dapur Pusat.'
                : `Pesan produk dari Dapur Pusat untuk outlet ${lingkup}. Terima barang saat sudah sampai.`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={muatUlang}
            className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Muat ulang
          </button>
          <button
            type="button"
            onClick={() => setModal({ jenis: 'buat' })}
            className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Buat Order
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { judul: 'Menunggu Dikirim', nilai: String(hitung.diajukan ?? 0), sub: 'Order diajukan', tegas: (hitung.diajukan ?? 0) > 0 },
          { judul: 'Dalam Pengiriman', nilai: String(hitung.dikirim ?? 0), sub: 'Belum dikonfirmasi diterima' },
          { judul: 'Diterima', nilai: String(hitung.diterima ?? 0), sub: '200 order terakhir' },
          { judul: 'Sisa Tagihan', nilai: formatRupiah(sisaTagihan), sub: pusat ? 'Piutang franchise' : 'Hutang ke Dapur Pusat' },
        ].map((k) => (
          <div key={k.judul} className={`rounded-2xl border p-4 bg-white ${k.tegas ? 'border-amber-200' : 'border-gray-200'}`}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{k.judul}</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-gray-900">{k.nilai}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <nav className="p-3 border-b border-gray-100 flex gap-1.5 overflow-x-auto" aria-label="Filter status">
          {(['semua', 'diajukan', 'dikirim', 'diterima', 'ditolak', 'dibatalkan'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap ${
                filter === s ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s === 'semua' ? 'Semua' : LABEL[s].teks}
              {s !== 'semua' && hitung[s] ? ` (${hitung[s]})` : ''}
            </button>
          ))}
        </nav>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">No Order</th>
                {pusat && <th className="text-left px-4 py-3">Outlet</th>}
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Tagihan</th>
                <th className="text-right px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tampil.map((o) => (
                <OrderBaris
                  key={o.id}
                  o={o}
                  pusat={pusat}
                  buka={buka === o.id}
                  onToggle={() => setBuka(buka === o.id ? null : o.id)}
                  sibuk={proses === o.id}
                  onKirim={() => setModal({ jenis: 'kirim', order: o })}
                  onBatal={() => setModal({ jenis: 'batal', order: o })}
                  onTerima={() => terima(o)}
                />
              ))}
              {!loading && tampil.length === 0 && (
                <tr>
                  <td colSpan={pusat ? 6 : 5} className="px-4 py-10 text-center text-gray-500">
                    Belum ada order.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal?.jenis === 'buat' && (
        <ModalBuat
          katalog={katalog}
          lingkup={lingkup}
          outlet={outlet}
          onClose={() => setModal(null)}
          onSaved={(pesan) => {
            setModal(null);
            notify(pesan, 'success');
            muatUlang();
          }}
          notify={notify}
        />
      )}
      {modal && modal.jenis !== 'buat' && (
        <ModalAksi
          jenis={modal.jenis}
          order={modal.order}
          pusat={pusat}
          onClose={() => setModal(null)}
          onSaved={(pesan) => {
            setModal(null);
            notify(pesan, 'success');
            muatUlang();
          }}
          notify={notify}
        />
      )}
    </div>
  );
}

function OrderBaris({
  o,
  pusat,
  buka,
  onToggle,
  sibuk,
  onKirim,
  onBatal,
  onTerima,
}: {
  o: Order;
  pusat: boolean;
  buka: boolean;
  onToggle: () => void;
  sibuk: boolean;
  onKirim: () => void;
  onBatal: () => void;
  onTerima: () => void;
}) {
  const tombol = 'h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50';
  return (
    <>
      <tr className="hover:bg-gray-50/60">
        <td className="px-4 py-3">
          <button type="button" onClick={onToggle} className="text-left" aria-expanded={buka}>
            <div className="font-mono text-xs font-semibold text-gray-900 underline-offset-2 hover:underline">{o.noOrder}</div>
            <div className="text-[11px] text-gray-500">
              {formatTanggalWaktu(o.tanggal)} · {o.items.length} produk
            </div>
          </button>
        </td>
        {pusat && <td className="px-4 py-3 font-semibold text-gray-900">{o.franchise}</td>}
        <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatRupiah(o.total)}</td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${LABEL[o.status].cls}`}>{LABEL[o.status].teks}</span>
          {o.alasan && <div className="text-[11px] text-gray-500 mt-1">{o.alasan}</div>}
        </td>
        <td className="px-4 py-3 text-xs">
          {o.noFaktur ? (
            <>
              <div className="font-mono text-gray-700">{o.noFaktur}</div>
              <div className={Number(o.tagihan?.sisaPiutang ?? 0) > 0 ? 'text-red-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                {o.tagihan ? (Number(o.tagihan.sisaPiutang) > 0 ? `Sisa ${formatRupiah(o.tagihan.sisaPiutang)}` : 'Lunas') : 'Faktur dibatalkan'}
              </div>
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
          {pusat && o.status === 'diajukan' && (
            <button type="button" onClick={onKirim} className={`${tombol} bg-emerald-600 text-white hover:bg-emerald-500`}>
              <Truck className="w-3.5 h-3.5" /> Kirim
            </button>
          )}
          {o.status === 'dikirim' && (
            <button type="button" disabled={sibuk} onClick={onTerima} className={`${tombol} bg-emerald-600 text-white hover:bg-emerald-500`}>
              <PackageCheck className="w-3.5 h-3.5" /> {sibuk ? 'Memproses...' : 'Terima Barang'}
            </button>
          )}
          {(o.status === 'diajukan' || (pusat && o.status === 'dikirim')) && (
            <button type="button" onClick={onBatal} className={`${tombol} border border-gray-200 text-gray-700 hover:bg-gray-50`}>
              <XCircle className="w-3.5 h-3.5" />
              {o.status === 'dikirim' ? 'Batal Kirim' : pusat ? 'Tolak' : 'Batalkan'}
            </button>
          )}
        </td>
      </tr>
      {buka && (
        <tr className="bg-gray-50/60">
          <td colSpan={pusat ? 6 : 5} className="px-4 py-3">
            <table className="w-full text-xs">
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.id}>
                    <td className="py-1 text-gray-800">{i.namaBarang}</td>
                    <td className="py-1 text-right tabular-nums text-gray-600">
                      {i.qty} × {formatRupiah(i.harga)}
                    </td>
                    <td className="py-1 text-right tabular-nums font-semibold w-36">{formatRupiah(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {o.catatan && <p className="text-[11px] text-gray-500 mt-2">Catatan: {o.catatan}</p>}
          </td>
        </tr>
      )}
    </>
  );
}

function ModalBuat({
  katalog,
  lingkup,
  outlet,
  onClose,
  onSaved,
  notify,
}: {
  katalog: Katalog[];
  lingkup: string | null;
  outlet: string[];
  onClose: () => void;
  onSaved: (pesan: string) => void;
  notify: Notify;
}) {
  const [qty, setQty] = useState<Record<string, string>>({});
  const [franchise, setFranchise] = useState(lingkup ?? '');
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const items = katalog.map((k) => ({ ...k, qty: Math.max(0, Math.floor(Number(qty[k.sku]) || 0)) })).filter((k) => k.qty > 0);
  const total = items.reduce((s, i) => s + i.qty * i.hargaFranchise, 0);

  const simpan = async () => {
    if (submitting || items.length === 0 || !franchise) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/franchise/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ franchise, catatan, items: items.map((i) => ({ sku: i.sku, qty: i.qty })) }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.message);
      onSaved(j.message);
    } catch (e) {
      notify(e instanceof Error && e.message ? e.message : 'Gagal membuat order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Bingkai judul="Buat Order ke Dapur Pusat" sub="Harga sesuai harga franchise di Master Resep" onClose={onClose} lebar="max-w-3xl">
      <div className="flex-1 overflow-y-auto p-5 sm:px-8 space-y-4">
        {lingkup === null && (
          <label className="text-xs font-semibold text-gray-700 space-y-1 block">
            <span>Outlet franchise pemesan</span>
            <select value={franchise} onChange={(e) => setFranchise(e.target.value)} className={inputCls}>
              <option value="">{outlet.length ? 'Pilih outlet' : 'Belum ada outlet franchise (tambah di Manajemen Cabang)'}</option>
              {outlet.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
          {katalog.map((k) => (
            <div key={k.sku} className="flex items-center gap-3 p-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{k.namaBarang}</div>
                <div className="text-[11px] text-gray-500">
                  {formatRupiah(k.hargaFranchise)} / unit · stok Dapur Pusat {k.stokPusat}
                </div>
              </div>
              <input
                type="number"
                min={0}
                step={1}
                value={qty[k.sku] ?? ''}
                onChange={(e) => setQty((q) => ({ ...q, [k.sku]: e.target.value }))}
                placeholder="0"
                aria-label={`Jumlah ${k.namaBarang}`}
                className={`${inputCls} max-w-[96px] text-right`}
              />
            </div>
          ))}
          {katalog.length === 0 && (
            <p className="p-4 text-sm text-gray-500 text-center">Belum ada produk dengan harga franchise. Atur di Master Resep & HPP.</p>
          )}
        </div>
        <label className="text-xs font-semibold text-gray-700 space-y-1 block">
          <span>Catatan</span>
          <input value={catatan} onChange={(e) => setCatatan(e.target.value)} className={inputCls} placeholder="Opsional, mis. kirim pagi" />
        </label>
      </div>
      <div className="px-5 sm:px-8 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
        <div className="text-sm">
          Total <strong className="tabular-nums">{formatRupiah(total)}</strong>
          <span className="text-gray-500"> · {items.length} produk</span>
        </div>
        <button
          type="button"
          onClick={simpan}
          disabled={submitting || items.length === 0 || !franchise}
          className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
        >
          {submitting ? 'Mengirim...' : 'Kirim Order'}
        </button>
      </div>
    </Bingkai>
  );
}

function ModalAksi({
  jenis,
  order,
  pusat,
  onClose,
  onSaved,
  notify,
}: {
  jenis: 'kirim' | 'batal';
  order: Order;
  pusat: boolean;
  onClose: () => void;
  onSaved: (pesan: string) => void;
  notify: Notify;
}) {
  const [tempo, setTempo] = useState('14');
  const [alasan, setAlasan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const butuhAlasan = jenis === 'batal' && pusat;

  const judul =
    jenis === 'kirim' ? 'Kirim Order' : order.status === 'dikirim' ? 'Batalkan Pengiriman' : pusat ? 'Tolak Order' : 'Batalkan Order';
  const sub =
    jenis === 'kirim'
      ? 'Terbit faktur tempo atas nama outlet, stok Dapur Pusat berkurang'
      : order.status === 'dikirim'
        ? 'Faktur dibatalkan dan stok Dapur Pusat dikembalikan'
        : `${order.noOrder} · ${order.franchise}`;

  const simpan = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const j = await aksiOrder(order.id, jenis === 'kirim' ? { aksi: 'kirim', tempoHari: Number(tempo) } : { aksi: 'batal', alasan });
      if (!j.success) throw new Error(j.message);
      onSaved(jenis === 'kirim' ? `Order ${order.noOrder} dikirim, faktur ${j.data.noFaktur}` : `Order ${order.noOrder} ${j.data.status}`);
    } catch (e) {
      notify(e instanceof Error && e.message ? e.message : 'Aksi gagal', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Bingkai judul={judul} sub={sub} onClose={onClose}>
      <div className="p-5 space-y-4">
        <dl className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs">
          <div>
            <dt className="text-gray-500">Outlet</dt>
            <dd className="font-semibold text-gray-900">{order.franchise}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Total</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">{formatRupiah(order.total)}</dd>
          </div>
        </dl>
        {jenis === 'kirim' ? (
          <label className="text-xs font-semibold text-gray-700 space-y-1 block">
            <span>Jatuh tempo pembayaran (hari)</span>
            <input type="number" min={0} max={365} value={tempo} onChange={(e) => setTempo(e.target.value)} className={inputCls} />
          </label>
        ) : (
          <label className="text-xs font-semibold text-gray-700 space-y-1 block">
            <span>Alasan{butuhAlasan ? ' (wajib)' : ''}</span>
            <input value={alasan} onChange={(e) => setAlasan(e.target.value)} className={inputCls} placeholder="mis. stok habis" />
          </label>
        )}
      </div>
      <div className="px-5 sm:px-8 py-4 border-t border-gray-100 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Kembali
        </button>
        <button
          type="button"
          onClick={simpan}
          disabled={submitting || (butuhAlasan && !alasan.trim())}
          className={`h-10 px-5 rounded-xl text-white text-sm font-bold disabled:opacity-50 ${
            jenis === 'kirim' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
          }`}
        >
          {submitting ? 'Memproses...' : judul}
        </button>
      </div>
    </Bingkai>
  );
}
