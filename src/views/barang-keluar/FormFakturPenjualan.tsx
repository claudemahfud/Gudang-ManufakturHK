'use client';

// ============================================================
// Formulir Faktur Penjualan (grosir)
// Pelanggan, item + diskon, diskon faktur, PPN, ongkir, grand total,
// metode bayar & uang muka, sisa piutang. Perhitungan = hitungFaktur (sama dengan server).
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { Plus, Receipt, Trash2, X } from 'lucide-react';
import { formatRupiah } from '@/shared/lib/utils';
import { hitungFaktur, LABEL_STATUS, type MetodeBayar } from '@/shared/lib/faktur-hitung';
import PilihSatuan from '@/shared/components/ui/PilihSatuan';

export interface InventoryOption {
  sku: string;
  namaBarang: string;
  stok: number;
  hargaJual: string | null;
  settingPcs?: number;
  pakaiKarton?: boolean;
}

/** Isi pcs per karton; 0 bila barang tidak dijual per karton. */
export const isiKarton = (p?: InventoryOption) =>
  p?.pakaiKarton && (p.settingPcs ?? 1) > 1 ? (p.settingPcs as number) : 0;

interface Kontak {
  id: string;
  nama: string;
  tipe: string;
  telepon: string | null;
  alamat: string | null;
}

interface Baris {
  sku: string;
  qty: number;
  hargaJual: number;
  diskon: number;
  satuan: 'pcs' | 'karton';
}

const barisKosong = (): Baris => ({ sku: '', qty: 1, hargaJual: 0, diskon: 0, satuan: 'pcs' });
const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const METODE: { id: MetodeBayar; label: string; hint: string }[] = [
  { id: 'tunai', label: 'Tunai', hint: 'Bayar di tempat' },
  { id: 'transfer', label: 'Transfer', hint: 'Transfer bank' },
  { id: 'tempo', label: 'Tempo', hint: 'Piutang, bayar nanti' },
];

const input =
  'w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition';
const label = 'block text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-wider';

export default function FormFakturPenjualan({
  inventoryList,
  onClose,
  onSaved,
  notify,
}: {
  inventoryList: InventoryOption[];
  onClose: () => void;
  onSaved: (noFaktur: string) => void;
  notify: (message: string, type: 'success' | 'error') => void;
}) {
  const [kontak, setKontak] = useState<Kontak[]>([]);
  const [tanggal, setTanggal] = useState(hariIni());
  const [pelanggan, setPelanggan] = useState('');
  const [telepon, setTelepon] = useState('');
  const [alamat, setAlamat] = useState('');
  const [salesman, setSalesman] = useState('');
  const [baris, setBaris] = useState<Baris[]>([barisKosong()]);
  const [diskonFaktur, setDiskonFaktur] = useState('');
  const [ppnPersen, setPpnPersen] = useState('0');
  const [ongkir, setOngkir] = useState('');
  const [metode, setMetode] = useState<MetodeBayar>('tunai');
  const [dibayar, setDibayar] = useState(''); // '' = otomatis (lunas utk tunai/transfer, 0 utk tempo)
  const [jatuhTempo, setJatuhTempo] = useState('');
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/kontak')
      .then((r) => r.json())
      .then((j) => setKontak((j.data || []).filter((k: Kontak) => k.tipe === 'pelanggan' || k.tipe === 'keduanya')))
      .catch(() => {});
  }, []);

  const pelangganTerpilih = kontak.find((k) => k.nama.toLowerCase() === pelanggan.trim().toLowerCase());
  const invBySku = useMemo(() => new Map(inventoryList.map((i) => [i.sku, i])), [inventoryList]);

  const h = hitungFaktur(baris, {
    diskonFaktur: Number(diskonFaktur) || 0,
    ppnPersen: Number(ppnPersen) || 0,
    ongkir: Number(ongkir) || 0,
    metodeBayar: metode,
    dibayar: dibayar === '' ? undefined : Number(dibayar) || 0,
  });

  const pilihPelanggan = (nama: string) => {
    setPelanggan(nama);
    const k = kontak.find((x) => x.nama.toLowerCase() === nama.trim().toLowerCase());
    if (k) {
      setTelepon(k.telepon || '');
      setAlamat(k.alamat || '');
    }
  };

  const ubahBaris = (i: number, patch: Partial<Baris>) =>
    setBaris((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));

  const pilihProduk = (i: number, sku: string) => {
    const p = invBySku.get(sku);
    ubahBaris(i, { sku, satuan: 'pcs', hargaJual: p?.hargaJual ? parseFloat(p.hargaJual) : 0 });
  };

  /** Ganti pcs <-> karton; harga ikut dikonversi dari harga jual per pcs master. */
  const gantiSatuan = (i: number, satuan: Baris['satuan']) => {
    const p = invBySku.get(baris[i].sku);
    const hargaPcs = p?.hargaJual ? parseFloat(p.hargaJual) : 0;
    ubahBaris(i, { satuan, hargaJual: satuan === 'karton' ? hargaPcs * isiKarton(p) : hargaPcs });
  };

  const qtyPcs = (b: Baris) => (b.satuan === 'karton' ? b.qty * isiKarton(invBySku.get(b.sku)) : b.qty);
  const stokKurang = baris.some((b) => b.sku && qtyPcs(b) > (invBySku.get(b.sku)?.stok ?? 0));
  const barisTidakLengkap = baris.some((b) => !b.sku || !(b.qty > 0));

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!pelanggan.trim()) return notify('Pelanggan wajib diisi', 'error');
    if (barisTidakLengkap) return notify('Lengkapi produk dan jumlah di setiap baris', 'error');
    if (stokKurang) return notify('Ada barang yang jumlahnya melebihi stok', 'error');

    setSubmitting(true);
    try {
      const res = await fetch('/api/barang-keluar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal,
          pelanggan: pelanggan.trim(),
          pelangganId: pelangganTerpilih?.id,
          telepon,
          alamat,
          salesman,
          keterangan: catatan,
          items: baris,
          diskonFaktur: Number(diskonFaktur) || 0,
          ppnPersen: Number(ppnPersen) || 0,
          ongkir: Number(ongkir) || 0,
          metodeBayar: metode,
          dibayar: dibayar === '' ? undefined : Number(dibayar) || 0,
          jatuhTempo: h.sisaPiutang > 0 && jatuhTempo ? jatuhTempo : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) return notify(json.message || 'Gagal menyimpan faktur', 'error');
      notify(`Faktur penjualan ${json.noFaktur} tersimpan`, 'success');
      onSaved(json.noFaktur);
    } catch {
      notify('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="faktur-jual-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[94vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 sm:px-8 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 id="faktur-jual-title" className="font-bold text-gray-900 text-lg">
                Faktur Penjualan
              </h2>
              <p className="text-xs text-gray-500">
                Nomor faktur dibuat otomatis saat disimpan. Stok berkurang dan pembayaran tercatat di kas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={simpan} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-5 sm:px-8 sm:p-6 space-y-5">
            {/* 1. Pelanggan & faktur */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <fieldset className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50/60">
                <legend className="px-1 text-xs font-bold text-emerald-800 uppercase tracking-wider">Ditagihkan Kepada</legend>
                <div>
                  <label htmlFor="fj-pelanggan" className={label}>
                    Pelanggan / Toko <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="fj-pelanggan"
                    list="fj-daftar-pelanggan"
                    required
                    value={pelanggan}
                    onChange={(e) => pilihPelanggan(e.target.value)}
                    placeholder="Ketik / pilih dari daftar kontak"
                    className={`${input} font-semibold`}
                  />
                  <datalist id="fj-daftar-pelanggan">
                    {kontak.map((k) => (
                      <option key={k.id} value={k.nama} />
                    ))}
                  </datalist>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {pelangganTerpilih ? 'Terhubung ke daftar kontak' : 'Pelanggan baru / tidak terdaftar'}
                  </p>
                </div>
                <div>
                  <label htmlFor="fj-telepon" className={label}>Telepon</label>
                  <input id="fj-telepon" value={telepon} onChange={(e) => setTelepon(e.target.value)} className={input} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="fj-alamat" className={label}>Alamat Kirim</label>
                  <input id="fj-alamat" value={alamat} onChange={(e) => setAlamat(e.target.value)} className={input} />
                </div>
              </fieldset>

              <fieldset className="grid grid-cols-2 lg:grid-cols-1 gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50/60">
                <legend className="px-1 text-xs font-bold text-emerald-800 uppercase tracking-wider">Detail Faktur</legend>
                <div>
                  <label htmlFor="fj-tanggal" className={label}>
                    Tanggal Faktur <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="fj-tanggal"
                    type="date"
                    required
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label htmlFor="fj-salesman" className={label}>Salesman</label>
                  <input
                    id="fj-salesman"
                    value={salesman}
                    onChange={(e) => setSalesman(e.target.value)}
                    placeholder="Nama salesman"
                    className={input}
                  />
                </div>
              </fieldset>
            </div>

            {/* 2. Rincian barang */}
            <section aria-labelledby="fj-barang" className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 id="fj-barang" className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Rincian Barang ({baris.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setBaris((p) => [...p, barisKosong()])}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Barang
                </button>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead className="bg-slate-900 text-white text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5 text-left w-8">#</th>
                      <th className="p-2.5 text-left">Produk</th>
                      <th className="p-2.5 text-center w-24">Qty</th>
                      <th className="p-2.5 text-left w-32">Beli</th>
                      <th className="p-2.5 text-right w-36">Harga / Satuan</th>
                      <th className="p-2.5 text-center w-20">Disk %</th>
                      <th className="p-2.5 text-right w-36">Jumlah</th>
                      <th className="p-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {baris.map((b, i) => {
                      const produk = invBySku.get(b.sku);
                      const stok = produk?.stok;
                      const isi = isiKarton(produk);
                      const lebih = !!b.sku && qtyPcs(b) > (stok ?? 0);
                      return (
                        <tr key={i} className="align-top">
                          <td className="p-2.5 text-gray-400 tabular-nums">{i + 1}</td>
                          <td className="p-2">
                            <select
                              required
                              aria-label={`Produk baris ${i + 1}`}
                              value={b.sku}
                              onChange={(e) => pilihProduk(i, e.target.value)}
                              className={`${input} font-semibold`}
                            >
                              <option value="">Pilih barang…</option>
                              {inventoryList.map((p) => (
                                <option key={p.sku} value={p.sku}>
                                  {p.sku} · {p.namaBarang} (stok {p.stok})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={1}
                              required
                              aria-label={`Qty baris ${i + 1}`}
                              aria-invalid={lebih}
                              value={b.qty}
                              onChange={(e) => ubahBaris(i, { qty: parseInt(e.target.value, 10) || 0 })}
                              className={`${input} text-center font-bold tabular-nums ${lebih ? 'border-red-400 bg-red-50' : ''}`}
                            />
                            {lebih && <div className="text-[10px] text-red-600 mt-0.5 text-center">Stok {stok ?? 0} pcs</div>}
                            {!lebih && b.satuan === 'karton' && (
                              <div className="text-[10px] text-gray-500 mt-0.5 text-center tabular-nums">= {qtyPcs(b)} pcs</div>
                            )}
                          </td>
                          <td className="p-2">
                            <PilihSatuan
                              compact
                              value={b.satuan}
                              onChange={(s) => gantiSatuan(i, s)}
                              produk={produk}
                              ariaLabel={`Satuan beli baris ${i + 1}`}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={0}
                              aria-label={`Harga baris ${i + 1}`}
                              value={b.hargaJual}
                              onChange={(e) => ubahBaris(i, { hargaJual: parseFloat(e.target.value) || 0 })}
                              className={`${input} text-right tabular-nums`}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              aria-label={`Diskon baris ${i + 1}`}
                              value={b.diskon}
                              onChange={(e) =>
                                ubahBaris(i, { diskon: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })
                              }
                              className={`${input} text-center tabular-nums`}
                            />
                          </td>
                          <td className="p-2.5 text-right font-bold text-gray-900 tabular-nums">
                            {formatRupiah(h.totalBaris[i] ?? 0)}
                          </td>
                          <td className="p-2">
                            <button
                              type="button"
                              onClick={() => setBaris((p) => p.filter((_, idx) => idx !== i))}
                              disabled={baris.length === 1}
                              aria-label={`Hapus baris ${i + 1}`}
                              className="w-9 h-9 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-25"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 3. Catatan + ringkasan & pembayaran */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <label htmlFor="fj-catatan" className={label}>Catatan Faktur</label>
                  <textarea
                    id="fj-catatan"
                    rows={3}
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    placeholder="Syarat pembayaran, nomor rekening, instruksi pengiriman…"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none resize-none"
                  />
                </div>

                <div>
                  <span className={label}>Metode Pembayaran</span>
                  <div role="radiogroup" aria-label="Metode pembayaran" className="grid grid-cols-3 gap-2">
                    {METODE.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={metode === m.id}
                        onClick={() => {
                          setMetode(m.id);
                          setDibayar('');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          metode === m.id
                            ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-sm font-bold text-gray-900">{m.label}</div>
                        <div className="text-[10px] text-gray-500">{m.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="fj-dibayar" className={label}>
                      {metode === 'tempo' ? 'Uang Muka (DP)' : 'Jumlah Dibayar'}
                    </label>
                    <input
                      id="fj-dibayar"
                      type="number"
                      min={0}
                      value={dibayar === '' ? h.dibayar : dibayar}
                      onChange={(e) => setDibayar(e.target.value)}
                      className={`${input} text-right tabular-nums font-semibold`}
                    />
                  </div>
                  {h.sisaPiutang > 0 && (
                    <div>
                      <label htmlFor="fj-tempo" className={label}>Jatuh Tempo</label>
                      <input
                        id="fj-tempo"
                        type="date"
                        value={jatuhTempo}
                        min={tanggal}
                        onChange={(e) => setJatuhTempo(e.target.value)}
                        className={input}
                      />
                      <p className="text-[10px] text-gray-400 mt-0.5">Kosong = 30 hari</p>
                    </div>
                  )}
                </div>
              </div>

              <dl className="lg:col-span-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Subtotal</dt>
                  <dd className="tabular-nums font-semibold">{formatRupiah(h.subtotal)}</dd>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <dt className="text-gray-600">
                    <label htmlFor="fj-diskon">Diskon Faktur (Rp)</label>
                  </dt>
                  <dd>
                    <input
                      id="fj-diskon"
                      type="number"
                      min={0}
                      value={diskonFaktur}
                      onChange={(e) => setDiskonFaktur(e.target.value)}
                      placeholder="0"
                      className="w-40 h-9 px-2.5 rounded-lg border border-gray-200 bg-white text-right tabular-nums outline-none focus:border-emerald-500"
                    />
                  </dd>
                </div>
                <div className="flex justify-between text-gray-500">
                  <dt>DPP (setelah diskon)</dt>
                  <dd className="tabular-nums">{formatRupiah(h.dpp)}</dd>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <dt className="text-gray-600 flex items-center gap-2">
                    <label htmlFor="fj-ppn">PPN</label>
                    <select
                      id="fj-ppn"
                      value={ppnPersen}
                      onChange={(e) => setPpnPersen(e.target.value)}
                      className="h-8 px-2 rounded-lg border border-gray-200 bg-white text-xs outline-none focus:border-emerald-500"
                    >
                      <option value="0">Tanpa PPN</option>
                      <option value="11">11%</option>
                      <option value="12">12%</option>
                    </select>
                  </dt>
                  <dd className="tabular-nums font-semibold">{formatRupiah(h.ppn)}</dd>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <dt className="text-gray-600">
                    <label htmlFor="fj-ongkir">Ongkos Kirim (Rp)</label>
                  </dt>
                  <dd>
                    <input
                      id="fj-ongkir"
                      type="number"
                      min={0}
                      value={ongkir}
                      onChange={(e) => setOngkir(e.target.value)}
                      placeholder="0"
                      className="w-40 h-9 px-2.5 rounded-lg border border-gray-200 bg-white text-right tabular-nums outline-none focus:border-emerald-500"
                    />
                  </dd>
                </div>
                <div className="flex justify-between items-baseline pt-3 mt-1 border-t-2 border-gray-200">
                  <dt className="font-bold text-gray-900 uppercase tracking-wide text-xs">Grand Total</dt>
                  <dd className="text-2xl font-black text-emerald-700 tabular-nums">{formatRupiah(h.grandTotal)}</dd>
                </div>
                <div className="flex justify-between text-gray-600">
                  <dt>Dibayar</dt>
                  <dd className="tabular-nums">{formatRupiah(h.dibayar)}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="font-semibold text-gray-800">Sisa Piutang</dt>
                  <dd className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        h.status === 'lunas'
                          ? 'bg-emerald-100 text-emerald-800'
                          : h.status === 'sebagian'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {LABEL_STATUS[h.status]}
                    </span>
                    <span className={`tabular-nums font-bold ${h.sisaPiutang > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                      {formatRupiah(h.sisaPiutang)}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 sm:px-8 py-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-white">
            <span className="text-xs text-gray-500">
              {baris.length} barang · {baris.reduce((s, b) => s + (b.qty || 0), 0)} pcs
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || stokKurang}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2"
              >
                {submitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Simpan Faktur Penjualan
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
