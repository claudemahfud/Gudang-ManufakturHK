'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, Search, Undo2, UserRound } from 'lucide-react';
import { formatRupiah, formatTanggal } from '@/shared/lib/utils';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';

// ============================================================
// Form Barang Masuk jenis "Retur dari Pelanggan".
// Dengan faktur: qty dibatasi sisa yang bisa diretur, nilai dihitung dari faktur,
// memotong piutang dulu lalu sisanya dikembalikan sebagai uang.
// Tanpa faktur: pelanggan diketik, uang dikembalikan opsional.
// ============================================================

interface InventoryOption {
  sku: string;
  namaBarang: string;
  hargaJual?: string | number | null;
}

interface FakturRingkas {
  noFaktur: string;
  tanggal: string;
  pelanggan: string;
  grandTotal: string;
  sisaPiutang: string;
}

interface BarisFaktur {
  sku: string;
  namaBarang: string;
  qtyTerjual: number;
  qtySudahRetur: number;
  qtyBisaRetur: number;
  nilaiPerPcs: number;
}

interface DetailFaktur {
  faktur: FakturRingkas & { dibayar: string; cabang: string };
  baris: BarisFaktur[];
  pemegang: { username: string; nama: string; tersedia: number }[];
}

type Toast = (type: 'success' | 'error' | 'warning' | 'info', message: string, penyebab?: string, title?: string) => void;

const n = (v: string | number | null | undefined) => Number(v) || 0;
const label = 'block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1';
const input =
  'w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition';

export default function FormReturPelanggan({
  inventoryList,
  onBatal,
  onTersimpan,
  showToast,
}: {
  inventoryList: InventoryOption[];
  onBatal: () => void;
  onTersimpan: () => void;
  showToast: Toast;
}) {
  const [sumber, setSumber] = useState<'faktur' | 'tanpa'>('faktur');
  const [cari, setCari] = useState('');
  const [daftarFaktur, setDaftarFaktur] = useState<FakturRingkas[]>([]);
  const [memuatFaktur, setMemuatFaktur] = useState(false);
  const [gagalFaktur, setGagalFaktur] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailFaktur | null>(null);

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [sku, setSku] = useState('');
  const [qty, setQty] = useState('');
  const [kondisi, setKondisi] = useState<'layak' | 'rusak'>('layak');
  const [alasan, setAlasan] = useState('');
  const [pelanggan, setPelanggan] = useState('');
  const [refundAktif, setRefundAktif] = useState(false);
  const [nilaiRefund, setNilaiRefund] = useState('');
  const [metodeRefund, setMetodeRefund] = useState<'tunai' | 'transfer'>('tunai');
  // '' belum dipilih, 'kantor', atau username penjual yang masih memegang uang faktur ini
  const [sumberRefund, setSumberRefund] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  // Cari faktur (debounce ringan)
  useEffect(() => {
    if (sumber !== 'faktur' || detail) return;
    let batal = false;
    const t = setTimeout(async () => {
      setMemuatFaktur(true);
      try {
        const res = await fetch(`/api/retur-pelanggan?q=${encodeURIComponent(cari)}`);
        const json = await res.json();
        if (batal) return;
        setGagalFaktur(json.success ? null : json.message || 'Gagal memuat faktur');
        setDaftarFaktur(json.success ? json.data || [] : []);
      } catch {
        if (!batal) {
          setGagalFaktur('Gagal memuat faktur (gangguan jaringan)');
          setDaftarFaktur([]);
        }
      } finally {
        if (!batal) setMemuatFaktur(false);
      }
    }, 300);
    return () => {
      batal = true;
      clearTimeout(t);
    };
  }, [cari, sumber, detail]);

  const pilihFaktur = async (noFaktur: string) => {
    try {
      const res = await fetch(`/api/retur-pelanggan?noFaktur=${encodeURIComponent(noFaktur)}`);
      const json = await res.json();
      if (!json.success) {
        showToast('error', json.message || 'Gagal memuat faktur', undefined, 'Faktur');
        return;
      }
      setDetail(json.data);
      setSumberRefund('');
      const pertama = (json.data.baris as BarisFaktur[]).find((b) => b.qtyBisaRetur > 0);
      setSku(pertama?.sku ?? '');
      setQty('');
    } catch {
      showToast('error', 'Gagal memuat faktur', 'Gangguan jaringan', 'Faktur');
    }
  };

  const gantiSumber = (s: 'faktur' | 'tanpa') => {
    setSumber(s);
    setDetail(null);
    setSku('');
    setQty('');
  };

  const barisDipilih = detail?.baris.find((b) => b.sku === sku) ?? null;
  const qtyNum = Math.max(0, Math.floor(n(qty)));

  // Pratinjau efek uang, sama dengan perhitungan server
  const pratinjau = useMemo(() => {
    if (sumber === 'faktur') {
      if (!detail || !barisDipilih) return null;
      const nilai = Math.round(barisDipilih.nilaiPerPcs * qtyNum * 100) / 100;
      const potong = Math.min(nilai, n(detail.faktur.sisaPiutang));
      const refund = Math.min(nilai - potong, n(detail.faktur.dibayar));
      return { nilai: potong + refund, potong, refund };
    }
    const refund = refundAktif ? n(nilaiRefund) : 0;
    return { nilai: refund, potong: 0, refund };
  }, [sumber, detail, barisDipilih, qtyNum, refundAktif, nilaiRefund]);

  // Sumber uang hanya ditanyakan bila ada refund tunai dan memang ada penjual yang menerima tunainya
  const tanyaSumber = sumber === 'faktur' && metodeRefund === 'tunai' && (pratinjau?.refund ?? 0) > 0 && (detail?.pemegang.length ?? 0) > 0;

  const aktifkanRefund = (aktif: boolean) => {
    setRefundAktif(aktif);
    // Usulan nilai refund tanpa faktur: harga jual master × qty (boleh diubah)
    const inv = inventoryList.find((i) => i.sku === sku);
    if (aktif && !nilaiRefund && inv) setNilaiRefund(String(n(inv.hargaJual) * qtyNum));
  };

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (menyimpan) return;
    if (sumber === 'faktur' && !detail) return showToast('warning', 'Pilih faktur asal dulu', undefined, 'Validasi Form');
    if (!sku || qtyNum <= 0) return showToast('warning', 'Pilih barang dan isi qty retur', undefined, 'Validasi Form');
    if (barisDipilih && qtyNum > barisDipilih.qtyBisaRetur) {
      return showToast('warning', `Qty maksimal ${barisDipilih.qtyBisaRetur} pcs`, 'Sisanya sudah pernah diretur.', 'Validasi Form');
    }
    if (sumber === 'tanpa' && !pelanggan.trim()) return showToast('warning', 'Isi nama pelanggan', undefined, 'Validasi Form');

    if (tanyaSumber && !sumberRefund) return showToast('warning', 'Pilih uang refund diambil dari mana', undefined, 'Validasi Form');

    setMenyimpan(true);
    try {
      const res = await fetch('/api/barang-masuk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenis: 'RETUR_PELANGGAN',
          tanggal,
          sku,
          qty: qtyNum,
          kondisi,
          alasan: alasan.trim() || null,
          noFaktur: sumber === 'faktur' ? detail?.faktur.noFaktur : null,
          pelanggan: sumber === 'tanpa' ? pelanggan.trim() : null,
          nilaiRefund: sumber === 'tanpa' && refundAktif ? n(nilaiRefund) : 0,
          metodeRefund,
          sumberRefund: tanyaSumber && sumberRefund !== 'kantor' ? sumberRefund : null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        showToast('error', json.message || 'Gagal mencatat retur', json.penyebab, 'Retur Gagal');
        return;
      }
      const d = json.data as { potong: number; refund: number };
      const efek = [
        kondisi === 'layak' ? `stok +${qtyNum} pcs` : 'tercatat di Laporan Rusak',
        d.potong > 0 ? `piutang dipotong ${formatRupiah(d.potong)}` : '',
        d.refund > 0 ? `refund ${formatRupiah(d.refund)} tercatat di Buku Kas` : '',
      ].filter(Boolean);
      showToast('success', `Retur ${sku} (${qtyNum} pcs) dicatat`, `${efek.join(', ')}. Muncul juga di menu Retur Barang.`, 'Retur Pelanggan');
      onTersimpan();
    } catch (err) {
      showToast('error', 'Gagal mencatat retur', err instanceof Error ? err.message : 'Gangguan jaringan', 'Koneksi Error');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <form onSubmit={simpan} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
          {/* Kolom kiri: asal retur */}
          <div className="space-y-4">
            <div className="text-xs font-bold text-amber-800 uppercase tracking-wider pb-1 border-b border-amber-100 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Asal Retur</span>
            </div>

            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Asal retur">
              {([
                ['faktur', 'Dari Faktur Penjualan', 'Nilai & piutang otomatis'],
                ['tanpa', 'Tanpa Faktur', 'Penjualan POS / umum'],
              ] as const).map(([v, judul, sub]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={sumber === v}
                  onClick={() => gantiSumber(v)}
                  className={`text-left p-3 rounded-xl border transition ${
                    sumber === v ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-sm font-bold text-gray-900">{judul}</div>
                  <div className="text-[11px] text-gray-500">{sub}</div>
                </button>
              ))}
            </div>

            {sumber === 'faktur' && !detail && (
              <div>
                <label className={label} htmlFor="cari-faktur">
                  Cari Faktur <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="cari-faktur"
                    value={cari}
                    onChange={(e) => setCari(e.target.value)}
                    placeholder="No. faktur atau nama pelanggan"
                    className={`${input} pl-9`}
                  />
                </div>
                <ul className="mt-2 max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl">
                  {memuatFaktur && <li className="p-3 text-xs text-gray-400"><MemuatProgres teks="Memuat faktur…" /></li>}
                  {!memuatFaktur && gagalFaktur && <li className="p-3 text-xs text-red-600">{gagalFaktur}</li>}
                  {!memuatFaktur && !gagalFaktur && daftarFaktur.length === 0 && (
                    <li className="p-3 text-xs text-gray-400">Tidak ada faktur yang cocok.</li>
                  )}
                  {!memuatFaktur &&
                    daftarFaktur.map((f) => (
                      <li key={f.noFaktur}>
                        <button
                          type="button"
                          onClick={() => pilihFaktur(f.noFaktur)}
                          className="w-full text-left p-3 hover:bg-amber-50 transition"
                        >
                          <div className="flex justify-between gap-2">
                            <span className="text-xs font-mono font-semibold text-gray-900">{f.noFaktur}</span>
                            <span className="text-xs font-semibold text-gray-900">{formatRupiah(f.grandTotal)}</span>
                          </div>
                          <div className="flex justify-between gap-2 text-[11px] text-gray-500">
                            <span>
                              {f.pelanggan} · {formatTanggal(f.tanggal)}
                            </span>
                            <span>{n(f.sisaPiutang) > 0 ? `sisa ${formatRupiah(f.sisaPiutang)}` : 'lunas'}</span>
                          </div>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {sumber === 'faktur' && detail && (
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-gray-900">{detail.faktur.noFaktur}</span>
                  <button type="button" onClick={() => setDetail(null)} className="text-xs font-semibold text-amber-700 hover:underline">
                    Ganti faktur
                  </button>
                </div>
                <div className="text-sm font-semibold text-gray-900">{detail.faktur.pelanggan}</div>
                <div className="text-[11px] text-gray-600">
                  {formatTanggal(detail.faktur.tanggal)} · total {formatRupiah(detail.faktur.grandTotal)} · dibayar{' '}
                  {formatRupiah(detail.faktur.dibayar)} · sisa piutang {formatRupiah(detail.faktur.sisaPiutang)}
                </div>
                <div className="text-[11px] text-gray-500">Stok retur masuk ke cabang {detail.faktur.cabang}.</div>
              </div>
            )}

            {sumber === 'tanpa' && (
              <div>
                <label className={label} htmlFor="retur-pelanggan">
                  Nama Pelanggan <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <UserRound className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="retur-pelanggan"
                    value={pelanggan}
                    onChange={(e) => setPelanggan(e.target.value)}
                    placeholder="Nama pelanggan yang mengembalikan"
                    className={`${input} pl-9`}
                  />
                </div>
              </div>
            )}

            <div>
              <label className={label} htmlFor="retur-tanggal">
                Tanggal Retur <span className="text-red-500">*</span>
              </label>
              <input id="retur-tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={input} required />
            </div>
          </div>

          {/* Kolom kanan: barang, kondisi, uang */}
          <div className="space-y-4">
            <div className="text-xs font-bold text-amber-800 uppercase tracking-wider pb-1 border-b border-amber-100 flex items-center gap-1.5">
              <Undo2 className="w-3.5 h-3.5" />
              <span>Barang Retur &amp; Penyelesaian</span>
            </div>

            <div>
              <label className={label} htmlFor="retur-sku">
                Barang <span className="text-red-500">*</span>
              </label>
              <select
                id="retur-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className={input}
                disabled={sumber === 'faktur' && !detail}
              >
                <option value="">-- Pilih barang --</option>
                {sumber === 'faktur'
                  ? detail?.baris.map((b) => (
                      <option key={b.sku} value={b.sku} disabled={b.qtyBisaRetur <= 0}>
                        {b.namaBarang} ({b.sku}) · bisa retur {b.qtyBisaRetur}/{b.qtyTerjual} pcs
                      </option>
                    ))
                  : inventoryList.map((i) => (
                      <option key={i.sku} value={i.sku}>
                        {i.namaBarang} ({i.sku})
                      </option>
                    ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="retur-qty">
                  Qty (pcs) <span className="text-red-500">*</span>
                </label>
                <input
                  id="retur-qty"
                  type="number"
                  min={1}
                  max={barisDipilih?.qtyBisaRetur}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="0"
                  className={input}
                />
                {barisDipilih && <p className="text-[11px] text-gray-500 mt-1">Maks. {barisDipilih.qtyBisaRetur} pcs</p>}
              </div>
              <div>
                <span className={label}>Kondisi Barang</span>
                <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Kondisi barang">
                  {([
                    ['layak', 'Layak jual'],
                    ['rusak', 'Rusak'],
                  ] as const).map(([v, t]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={kondisi === v}
                      onClick={() => setKondisi(v)}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition ${
                        kondisi === v
                          ? v === 'layak'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                            : 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 -mt-2">
              {kondisi === 'layak'
                ? 'Barang masuk lagi ke stok gudang dengan HPP yang sama.'
                : 'Barang tidak masuk stok; dicatat di Laporan Rusak & Retur sebagai kerugian.'}
            </p>

            <div>
              <label className={label} htmlFor="retur-alasan">
                Alasan Retur
              </label>
              <textarea
                id="retur-alasan"
                rows={2}
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="Mis. kemasan bocor, salah kirim, kedaluwarsa"
                className={input}
              />
            </div>

            {sumber === 'tanpa' && (
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <input type="checkbox" checked={refundAktif} onChange={(e) => aktifkanRefund(e.target.checked)} className="w-4 h-4 accent-amber-600" />
                Kembalikan uang ke pelanggan
              </label>
            )}
            {sumber === 'tanpa' && refundAktif && (
              <div>
                <label className={label} htmlFor="retur-nilai">
                  Nilai Refund (Rp)
                </label>
                <input id="retur-nilai" type="number" min={0} value={nilaiRefund} onChange={(e) => setNilaiRefund(e.target.value)} className={input} />
              </div>
            )}

            {pratinjau && pratinjau.refund > 0 && (
              <div>
                <span className={label}>Uang Dikembalikan Lewat</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['tunai', 'transfer'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={metodeRefund === m}
                      onClick={() => setMetodeRefund(m)}
                      className={`py-2 rounded-xl border text-xs font-bold capitalize transition ${
                        metodeRefund === m ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tanyaSumber && detail && pratinjau && (
              <div>
                <label className={label} htmlFor="retur-sumber">
                  Uang Diambil Dari <span className="text-red-500">*</span>
                </label>
                <select id="retur-sumber" value={sumberRefund} onChange={(e) => setSumberRefund(e.target.value)} className={input}>
                  <option value="">-- Pilih sumber uang --</option>
                  <option value="kantor">Kas kantor</option>
                  {detail.pemegang.map((p) => (
                    <option key={p.username} value={p.username} disabled={p.tersedia + 0.009 < pratinjau.refund}>
                      Uang penjualan {p.nama} (dipegang {formatRupiah(p.tersedia)})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">Bila diambil dari uang penjual, jumlah yang harus disetor berkurang.</p>
              </div>
            )}

            {pratinjau && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-1.5 text-xs">
                <div className="flex justify-between font-bold text-amber-900 text-sm">
                  <span>Nilai Retur</span>
                  <span>{formatRupiah(pratinjau.nilai)}</span>
                </div>
                {sumber === 'faktur' && (
                  <div className="flex justify-between text-gray-700">
                    <span>Potong sisa piutang faktur</span>
                    <span>{formatRupiah(pratinjau.potong)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-700">
                  <span>Uang dikembalikan (kas keluar)</span>
                  <span>{formatRupiah(pratinjau.refund)}</span>
                </div>
                {sumber === 'faktur' && barisDipilih && (
                  <p className="text-[11px] text-gray-500 pt-1">
                    {formatRupiah(barisDipilih.nilaiPerPcs)}/pcs dari harga faktur (setelah diskon &amp; PPN, tanpa ongkir).
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex justify-end gap-3 shrink-0">
        <button
          type="button"
          onClick={onBatal}
          disabled={menyimpan}
          className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-xs sm:text-sm font-semibold hover:bg-gray-100 transition"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={menyimpan}
          className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition disabled:opacity-50 shadow-md shadow-amber-600/20 flex items-center gap-2"
        >
          {menyimpan && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          <span>Simpan Retur</span>
        </button>
      </div>
    </form>
  );
}
