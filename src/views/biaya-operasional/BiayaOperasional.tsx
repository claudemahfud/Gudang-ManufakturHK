'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { formatRupiah, formatTanggal } from '@/shared/lib/utils';
import { useDivision } from '@/shared/context/DivisionContext';
import Bingkai from '@/shared/components/ui/Bingkai';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';
import { ambil, kirimJson, kontrol, tglWib, Toast } from '@/views/laporan-keuangan/util';
import { sarankanAkunBiaya } from '@/shared/lib/pemetaan-akuntansi';
import { LABEL_SUMBER_BIAYA, SUMBER_BIAYA, type ItemBiaya, type SumberBiaya } from '@/shared/lib/biaya-aturan';
import FotoNota from './FotoNota';
import GaleriNota from './GaleriNota';
import LencanaStatus from './LencanaStatus';

// ============================================================
// PAGE: Biaya Operasional — input oleh SEMUA karyawan
// Route: /biaya-operasional
// Diajukan "menunggu"; dibukukan setelah Finance Pusat menerima nota fisik & menyetujui
// (lihat menu Keuangan > Laporan Operasional).
// ============================================================

interface Data {
  items: ItemBiaya[];
  akun: { kode: string; nama: string }[];
  uangPenjualan: number;
}

const lbl = 'block text-xs font-semibold text-gray-700';

export default function BiayaOperasional() {
  const { division, cabang } = useDivision();
  const [data, setData] = useState<Data | null>(null);
  const [versi, setVersi] = useState(0);
  const [baru, setBaru] = useState(false);
  const [detail, setDetail] = useState<ItemBiaya | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    let batal = false;
    ambil<Data>(`/api/biaya-operasional?divisi=${division}`).then((h) => {
      if (batal) return;
      if (h.ok) setData(h.data);
      else notify(h.pesan, 'error');
    });
    return () => {
      batal = true;
    };
  }, [division, versi, notify]);

  const muatUlang = () => setVersi((v) => v + 1);
  const total = (cek: (i: ItemBiaya) => boolean) => (data?.items ?? []).filter(cek).reduce((s, i) => s + i.jumlah, 0);

  const batalkan = async (i: ItemBiaya) => {
    if (!window.confirm(`Batalkan pengajuan ${i.noBiaya} sebesar ${formatRupiah(i.jumlah)}?`)) return;
    const h = await ambil<unknown>(`/api/biaya-operasional/${i.id}`, { method: 'DELETE' });
    if (!h.ok) return notify(h.pesan, 'error');
    notify('Pengajuan dibatalkan', 'success');
    muatUlang();
  };

  return (
    <div className="space-y-6">
      <Toast toast={toast} />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-700">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Biaya Operasional</h1>
            <p className="text-sm text-gray-500">Catat setiap pengeluaran saat berjualan dan bekerja di lapangan. Serahkan nota fisik ke Finance Pusat.</p>
          </div>
        </div>
        <button type="button" onClick={() => setBaru(true)} disabled={!data} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
          <Plus className="h-4 w-4" aria-hidden="true" /> Catat Biaya
        </button>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ['Menunggu persetujuan', total((i) => i.status === 'menunggu')],
          ['Belum direimburse ke saya', total((i) => i.status === 'disetujui' && i.sumber === 'pribadi')],
          ['Uang penjualan yang saya pegang', data?.uangPenjualan ?? 0],
        ].map(([judul, nilai]) => (
          <div key={judul} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{judul}</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-gray-900">{formatRupiah(Number(nilai))}</div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 p-4 text-sm font-bold text-gray-900">Biaya Saya</h2>
        <div className="overflow-x-auto">
          <table className="tabel-kartu w-full min-w-[760px] text-sm">
            <thead className="bg-slate-900 text-[11px] uppercase tracking-wider text-white">
              <tr>
                <th className="p-3 text-left">Tanggal</th>
                <th className="p-3 text-left">Biaya</th>
                <th className="p-3 text-right">Jumlah</th>
                <th className="p-3 text-left">Sumber Dana</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!data ? (
                <tr><td colSpan={6} className="p-10 text-center text-gray-400"><MemuatProgres teks="Memuat biaya…" /></td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-gray-500">Belum ada biaya yang Anda catat.</td></tr>
              ) : (
                data.items.map((i) => (
                  <tr key={i.id} className="align-top">
                    <td data-label="Tanggal" className="whitespace-nowrap p-3 text-gray-700">{formatTanggal(i.tanggal)}</td>
                    <td data-label="Biaya" className="p-3">
                      <span className="font-semibold text-gray-900">{i.kategori}</span>
                      <span className="block text-xs text-gray-500">{i.noBiaya} · {i.keterangan}</span>
                      {i.alasanTolak && <span className="block text-xs font-semibold text-red-700">Alasan: {i.alasanTolak}</span>}
                    </td>
                    <td data-label="Jumlah" className="whitespace-nowrap p-3 text-right font-bold tabular-nums text-gray-900">{formatRupiah(i.jumlah)}</td>
                    <td data-label="Sumber Dana" className="p-3 text-xs text-gray-600">{LABEL_SUMBER_BIAYA[i.sumber]}</td>
                    <td data-label="Status" className="p-3">
                      <LencanaStatus status={i.status} sumber={i.sumber} />
                      {i.status === 'menunggu' && i.jumlahFoto === 0 && <span className="mt-1 block text-[11px] font-semibold text-amber-700">Foto nota belum ada</span>}
                    </td>
                    <td data-aksi className="p-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button type="button" onClick={() => setDetail(i)} className="h-9 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50">Nota ({i.jumlahFoto})</button>
                        {i.status === 'menunggu' && (
                          <button type="button" onClick={() => batalkan(i)} className="h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50">Batalkan</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {baru && data && (
        <ModalBiaya akun={data.akun} uangPenjualan={data.uangPenjualan} divisi={division} cabang={cabang} onClose={() => setBaru(false)}
          onSaved={() => { setBaru(false); notify('Biaya diajukan. Serahkan nota fisik ke Finance Pusat.', 'success'); muatUlang(); }} />
      )}
      {detail && <ModalNota item={detail} onClose={() => setDetail(null)} onSaved={() => { notify('Foto nota ditambahkan', 'success'); muatUlang(); }} />}
    </div>
  );
}

function ModalNota({ item, onClose, onSaved }: { item: ItemBiaya; onClose: () => void; onSaved: () => void }) {
  const [foto, setFoto] = useState<string[]>([]);
  const [versi, setVersi] = useState(0);
  const [kirim, setKirim] = useState(false);
  const [galat, setGalat] = useState('');
  const [terunggah, setTerunggah] = useState(item.jumlahFoto);

  const unggah = async () => {
    setKirim(true);
    setGalat('');
    const h = await kirimJson(`/api/biaya-operasional/${item.id}/lampiran`, { foto });
    setKirim(false);
    if (!h.ok) return setGalat(h.pesan);
    setTerunggah((n) => n + foto.length);
    setFoto([]);
    setVersi((v) => v + 1);
    onSaved();
  };

  return (
    <Bingkai judul="Foto Nota" sub={`${item.noBiaya} · ${item.kategori} · ${formatRupiah(item.jumlah)}`} onClose={onClose}>
      <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:px-8">
        <GaleriNota id={item.id} versi={versi} />
        {item.status === 'menunggu' && terunggah < 3 && (
          <>
            <FotoNota foto={foto} onChange={setFoto} maks={3 - terunggah} label="Tambah foto" />
            {foto.length > 0 && (
              <button type="button" onClick={unggah} disabled={kirim} className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {kirim ? 'Mengunggah…' : 'Unggah'}
              </button>
            )}
          </>
        )}
        {galat && <p role="alert" className="text-xs font-semibold text-red-600">{galat}</p>}
      </div>
    </Bingkai>
  );
}

function ModalBiaya({ akun, uangPenjualan, divisi, cabang, onClose, onSaved }: { akun: Data['akun']; uangPenjualan: number; divisi: string; cabang: string; onClose: () => void; onSaved: () => void }) {
  const [tanggal, setTanggal] = useState(tglWib());
  const [akunKode, setAkunKode] = useState('');
  const [akunManual, setAkunManual] = useState(false);
  const [jumlah, setJumlah] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [sumber, setSumber] = useState<SumberBiaya>(uangPenjualan > 0 ? 'penjualan' : 'pribadi');
  const [metode, setMetode] = useState<'tunai' | 'transfer'>('tunai');
  const [foto, setFoto] = useState<string[]>([]);
  const [kirim, setKirim] = useState(false);
  const [galat, setGalat] = useState('');

  const n = Number(jumlah) || 0;
  const lebih = sumber === 'penjualan' && n > uangPenjualan;
  const salah = !akunKode || !(n > 0) || !keterangan.trim() || lebih;

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salah || kirim) return;
    setKirim(true);
    setGalat('');
    const h = await kirimJson('/api/biaya-operasional', { tanggal, akunKode, jumlah: n, keterangan, sumber, metode, divisi, cabang, foto });
    setKirim(false);
    if (!h.ok) return setGalat(h.pesan);
    onSaved();
  };

  return (
    <Bingkai judul="Catat Biaya Operasional" sub="Diperiksa Finance Pusat sebelum masuk pembukuan" onClose={onClose}>
      <form onSubmit={simpan} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:px-8">
          <label className={lbl}>
            Rincian pengeluaran *
            <input required maxLength={500} value={keterangan} placeholder="Mis. bensin motor kirim barang"
              onChange={(e) => {
                setKeterangan(e.target.value);
                const saran = sarankanAkunBiaya(e.target.value);
                if (!akunManual && saran && akun.some((a) => a.kode === saran)) setAkunKode(saran);
              }}
              className={`${kontrol} mt-1 w-full font-normal`} />
          </label>
          <label className={lbl}>
            Jenis biaya *
            <select required value={akunKode} onChange={(e) => { setAkunManual(true); setAkunKode(e.target.value); }} className={`${kontrol} mt-1 w-full font-normal`}>
              <option value="">— Pilih jenis biaya —</option>
              {akun.map((a) => <option key={a.kode} value={a.kode}>{a.nama}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={lbl}>
              Nominal (Rp) *
              <input type="number" required min="1" step="any" inputMode="decimal" value={jumlah} onChange={(e) => setJumlah(e.target.value)} className={`${kontrol} mt-1 w-full font-semibold`} />
            </label>
            <label className={lbl}>
              Tanggal *
              <input type="date" required value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={`${kontrol} mt-1 w-full font-normal`} />
            </label>
          </div>
          <fieldset>
            <legend className={lbl}>Dibayar memakai *</legend>
            <div className="mt-1 grid gap-2">
              {SUMBER_BIAYA.map((s) => (
                <button key={s} type="button" aria-pressed={sumber === s} onClick={() => setSumber(s)}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-semibold ${sumber === s ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {LABEL_SUMBER_BIAYA[s]}
                  {s === 'penjualan' && <span className="block text-[11px] font-normal">Dipegang: {formatRupiah(uangPenjualan)}</span>}
                </button>
              ))}
            </div>
            {lebih && <p className="mt-1 text-[11px] font-semibold text-red-600">Melebihi uang penjualan yang Anda pegang.</p>}
          </fieldset>
          {sumber === 'kantor' && (
            <label className={lbl}>
              Dari kas kantor
              <select value={metode} onChange={(e) => setMetode(e.target.value as 'tunai' | 'transfer')} className={`${kontrol} mt-1 w-full font-normal`}>
                <option value="tunai">Kas Tunai</option>
                <option value="transfer">Bank (transfer)</option>
              </select>
            </label>
          )}
          <FotoNota foto={foto} onChange={setFoto} />
          <p className="text-[11px] text-gray-500">Foto boleh ditambahkan belakangan, tetapi biaya baru bisa disetujui setelah ada foto dan nota fisik diserahkan.</p>
          {galat && <p role="alert" className="text-xs font-semibold text-red-600">{galat}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50/80 px-5 py-3.5 sm:px-8">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Batal</button>
          <button type="submit" disabled={salah || kirim} className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {kirim ? 'Menyimpan…' : 'Ajukan Biaya'}
          </button>
        </div>
      </form>
    </Bingkai>
  );
}
