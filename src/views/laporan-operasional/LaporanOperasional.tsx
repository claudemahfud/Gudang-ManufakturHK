'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { formatRupiah, formatTanggal } from '@/shared/lib/utils';
import { useDivision } from '@/shared/context/DivisionContext';
import Bingkai from '@/shared/components/ui/Bingkai';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';
import { ambil, kirimJson, kontrol, KotakTerlarang, tglWib, Toast } from '@/views/laporan-keuangan/util';
import { LABEL_SUMBER_BIAYA, type ItemBiaya } from '@/shared/lib/biaya-aturan';
import GaleriNota from '@/views/biaya-operasional/GaleriNota';
import FotoNota from '@/views/biaya-operasional/FotoNota';
import LencanaStatus from '@/views/biaya-operasional/LencanaStatus';

// ============================================================
// PAGE: Laporan Operasional
// Route: /laporan-operasional
// Catatan akuntansi biaya seluruh karyawan, terisi otomatis dari menu Biaya Operasional.
// Finance Pusat: setujui (nota fisik + foto), tolak, reimburse.
// ============================================================

interface Data {
  items: ItemBiaya[];
  financePusat: boolean;
  direktur: boolean;
  username: string;
}

type Saring = 'semua' | 'menunggu' | 'reimburse' | 'dibukukan';
type Aksi = 'lihat' | 'setujui' | 'tolak' | 'batalkan' | 'reimburse';

const SARING: [Saring, string, (i: ItemBiaya) => boolean][] = [
  ['semua', 'Semua', () => true],
  ['menunggu', 'Menunggu', (i) => i.status === 'menunggu'],
  ['reimburse', 'Perlu Reimburse', (i) => i.status === 'disetujui' && i.sumber === 'pribadi'],
  ['dibukukan', 'Sudah Dibukukan', (i) => i.status === 'disetujui' || i.status === 'dibayar'],
];

const dibukukan = SARING[3][2];
const kelompok = (items: ItemBiaya[], kunci: (i: ItemBiaya) => string) => {
  const peta = new Map<string, ItemBiaya[]>();
  for (const i of items) peta.set(kunci(i), [...(peta.get(kunci(i)) ?? []), i]);
  return [...peta];
};
const jumlahkan = (items: ItemBiaya[]) => items.reduce((s, i) => s + i.jumlah, 0);

/** Akun yang didebit / dikredit saat biaya dibukukan. */
function jurnalSingkat(i: ItemBiaya) {
  const kredit = i.sumber === 'penjualan' ? 'Kas Belum Disetor (Penjual)' : i.sumber === 'pribadi' ? 'Hutang Reimburse Karyawan' : i.metode === 'transfer' ? 'Bank' : 'Kas Tunai';
  return { debit: `${i.akunKode ?? ''} ${i.kategori}`.trim(), kredit };
}

export default function LaporanOperasional() {
  const { division } = useDivision();
  const [dari, setDari] = useState(`${tglWib().slice(0, 8)}01`);
  const [sampai, setSampai] = useState(tglWib());
  const [data, setData] = useState<Data | null>(null);
  const [terlarang, setTerlarang] = useState(false);
  const [versi, setVersi] = useState(0);
  const [saring, setSaring] = useState<Saring>('semua');
  const [aktif, setAktif] = useState<{ item: ItemBiaya; aksi: Aksi } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    let batal = false;
    ambil<Data>(`/api/laporan-operasional?divisi=${division}&dari=${dari}&sampai=${sampai}`).then((h) => {
      if (batal) return;
      if (h.ok) setData(h.data);
      else {
        setTerlarang(h.terlarang);
        notify(h.pesan, 'error');
      }
    });
    return () => {
      batal = true;
    };
  }, [division, dari, sampai, versi, notify]);

  if (terlarang) return <KotakTerlarang />;

  const items = data?.items ?? [];
  const tampil = items.filter(SARING.find((s) => s[0] === saring)![2]);
  const hutang = items.filter(SARING[2][2]);
  // tagihan lama yang belum direimburse ikut terkirim, tetapi tidak dihitung sebagai beban periode ini
  const bebanPeriode = items.filter((i) => dibukukan(i) && new Date(i.tanggal) >= new Date(`${dari}T00:00:00+07:00`));
  const perKaryawan = kelompok(hutang, (i) => i.nama || i.username || '-');
  const perAkun = kelompok(bebanPeriode, (i) => `${i.akunKode ?? ''} ${i.kategori}`.trim());

  // Finance Pusat memproses milik orang lain; biaya Finance Pusat sendiri diproses Direktur Utama (dijaga juga di server)
  const bisaProses = (i: ItemBiaya) => !!data && i.username !== data.username && (data.financePusat || data.direktur);

  return (
    <div className="space-y-6">
      <Toast toast={toast} />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Laporan Operasional</h1>
            <p className="text-sm text-gray-500">Terisi otomatis dari Biaya Operasional seluruh karyawan.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" aria-label="Dari tanggal" value={dari} max={sampai} onChange={(e) => e.target.value && setDari(e.target.value)} className={kontrol} />
          <span className="text-xs text-gray-500">s.d.</span>
          <input type="date" aria-label="Sampai tanggal" value={sampai} min={dari} onChange={(e) => e.target.value && setSampai(e.target.value)} className={kontrol} />
          <button type="button" aria-label="Muat ulang" onClick={() => setVersi((v) => v + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {data && !data.financePusat && (
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
          Persetujuan dan reimburse dilakukan akun Finance Pusat. Biaya milik Finance Pusat sendiri disetujui Direktur Utama.
        </p>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ['Dibukukan pada periode ini', formatRupiah(jumlahkan(bebanPeriode))],
          [`Menunggu persetujuan (${items.filter((i) => i.status === 'menunggu').length})`, formatRupiah(jumlahkan(items.filter((i) => i.status === 'menunggu')))],
          [`Hutang reimburse (${hutang.length})`, formatRupiah(jumlahkan(hutang))],
        ].map(([judul, nilai]) => (
          <div key={judul} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{judul}</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-gray-900">{nilai}</div>
          </div>
        ))}
      </section>

      {(perAkun.length > 0 || perKaryawan.length > 0) && (
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {([['Beban per akun', perAkun], ['Hutang reimburse per karyawan', perKaryawan]] as const).map(([judul, baris]) => (
            <div key={judul} className="rounded-2xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-bold text-gray-900">{judul}</h2>
              <ul className="mt-2 divide-y divide-gray-100 text-sm">
                {baris.length === 0 ? <li className="py-2 text-gray-500">Tidak ada.</li> : baris.map(([nama, daftar]) => (
                  <li key={nama} className="flex justify-between gap-3 py-2">
                    <span className="text-gray-700">{nama}</span>
                    <strong className="tabular-nums text-gray-900">{formatRupiah(jumlahkan(daftar))}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-4" role="group" aria-label="Filter status">
          <h2 className="mr-2 text-sm font-bold text-gray-900">Catatan Biaya</h2>
          {SARING.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={saring === k} onClick={() => setSaring(k)}
              className={`h-9 rounded-lg border px-3 text-xs font-semibold ${saring === k ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="tabel-kartu w-full min-w-[960px] text-sm">
            <thead className="bg-slate-900 text-[11px] uppercase tracking-wider text-white">
              <tr>
                <th className="p-3 text-left">Tanggal</th>
                <th className="p-3 text-left">Karyawan</th>
                <th className="p-3 text-left">Rincian</th>
                <th className="p-3 text-left">Jurnal (Debit / Kredit)</th>
                <th className="p-3 text-right">Jumlah</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!data ? (
                <tr><td colSpan={7} className="p-10 text-center text-gray-400"><MemuatProgres teks="Memuat laporan…" /></td></tr>
              ) : tampil.length === 0 ? (
                <tr><td colSpan={7} className="p-10 text-center text-gray-500">Tidak ada catatan biaya.</td></tr>
              ) : tampil.map((i) => {
                const j = jurnalSingkat(i);
                const tombol = (aksi: Aksi, teks: string, kelas: string) => (
                  <button type="button" onClick={() => setAktif({ item: i, aksi })} className={`h-9 rounded-lg px-3 text-xs font-semibold ${kelas}`}>{teks}</button>
                );
                return (
                  <tr key={i.id} className="align-top">
                    <td data-label="Tanggal" className="whitespace-nowrap p-3 text-gray-700">{formatTanggal(i.tanggal)}</td>
                    <td data-label="Karyawan" className="p-3 font-semibold text-gray-900">{i.nama || i.username || '-'}</td>
                    <td data-label="Rincian" className="p-3 text-xs text-gray-600">
                      <span className="block font-mono">{i.noBiaya}</span>{i.keterangan}
                      {i.alasanTolak && <span className="block font-semibold text-red-700">Alasan: {i.alasanTolak}</span>}
                    </td>
                    <td data-label="Jurnal" className="p-3 text-xs text-gray-700">
                      {i.status === 'ditolak' || i.status === 'dibatalkan' ? '-' : (
                        <>
                          <span className="block">D: {j.debit}</span>
                          <span className="block">K: {j.kredit}</span>
                          {i.status === 'menunggu' && <span className="block text-amber-700">belum dibukukan</span>}
                          {i.status === 'dibayar' && <span className="block text-emerald-700">Reimburse {formatTanggal(i.reimburseAt!)} via {i.reimburseMetode === 'transfer' ? 'Bank' : 'Kas Tunai'}</span>}
                        </>
                      )}
                    </td>
                    <td data-label="Jumlah" className="whitespace-nowrap p-3 text-right font-bold tabular-nums text-gray-900">{formatRupiah(i.jumlah)}</td>
                    <td data-label="Status" className="p-3">
                      <LencanaStatus status={i.status} sumber={i.sumber} />
                      <span className="mt-1 block text-[11px] text-gray-500">{LABEL_SUMBER_BIAYA[i.sumber]}</span>
                    </td>
                    <td data-aksi className="p-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {tombol('lihat', `Nota (${i.jumlahFoto})`, 'border border-gray-200 text-gray-700 hover:bg-gray-50')}
                        {bisaProses(i) && i.status === 'menunggu' && (
                          <>
                            {tombol('setujui', 'Setujui', 'bg-emerald-600 text-white hover:bg-emerald-700')}
                            {tombol('tolak', 'Tolak', 'border border-red-200 text-red-700 hover:bg-red-50')}
                          </>
                        )}
                        {bisaProses(i) && i.status === 'disetujui' && (
                          <>
                            {i.sumber === 'pribadi' && tombol('reimburse', 'Reimburse', 'bg-blue-600 text-white hover:bg-blue-700')}
                            {tombol('batalkan', 'Batalkan', 'border border-red-200 text-red-700 hover:bg-red-50')}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {aktif && (
        <ModalProses {...aktif} onClose={() => setAktif(null)} onSaved={(pesan) => { setAktif(null); notify(pesan, 'success'); setVersi((v) => v + 1); }} />
      )}
    </div>
  );
}

const JUDUL: Record<Aksi, [string, string]> = {
  lihat: ['Foto Nota', ''],
  setujui: ['Setujui Biaya', 'Setujui & Bukukan'],
  tolak: ['Tolak Biaya', 'Tolak Biaya'],
  batalkan: ['Batalkan Biaya', 'Batalkan & Balik Jurnal'],
  reimburse: ['Reimburse Karyawan', 'Bayar Reimburse'],
};

function ModalProses({ item, aksi, onClose, onSaved }: { item: ItemBiaya; aksi: Aksi; onClose: () => void; onSaved: (pesan: string) => void }) {
  const [notaFisik, setNotaFisik] = useState(false);
  const [alasan, setAlasan] = useState('');
  const [metode, setMetode] = useState<'tunai' | 'transfer'>('tunai');
  const [bukti, setBukti] = useState<string[]>([]);
  const [kirim, setKirim] = useState(false);
  const [galat, setGalat] = useState('');
  const [judul, teks] = JUDUL[aksi];
  const butuhAlasan = aksi === 'tolak' || aksi === 'batalkan';
  const belumSiap = (aksi === 'setujui' && (!notaFisik || item.jumlahFoto === 0)) || (butuhAlasan && !alasan.trim()) || (aksi === 'reimburse' && item.jumlahFoto === 0);

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (aksi === 'lihat' || belumSiap || kirim) return;
    setKirim(true);
    setGalat('');
    const h = await kirimJson(`/api/biaya-operasional/${item.id}`, { aksi, notaFisik, alasan, metode, foto: bukti });
    setKirim(false);
    if (!h.ok) return setGalat(h.pesan);
    onSaved(`${judul}: ${item.noBiaya} berhasil`);
  };

  return (
    <Bingkai judul={judul} sub={`${item.noBiaya} · ${item.nama} · ${formatRupiah(item.jumlah)}`} onClose={onClose}>
      <form onSubmit={simpan} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:px-8">
          <p className="text-sm text-gray-700">{item.kategori}: {item.keterangan} <span className="block text-xs text-gray-500">{LABEL_SUMBER_BIAYA[item.sumber]}</span></p>
          <GaleriNota id={item.id} />
          {aksi === 'setujui' && (
            <label className="flex min-h-11 items-start gap-2 rounded-xl border border-gray-200 p-3 text-sm font-semibold text-gray-800">
              <input type="checkbox" checked={notaFisik} onChange={(e) => setNotaFisik(e.target.checked)} className="mt-0.5 h-4 w-4" />
              Nota / invoice fisik sudah saya terima dari karyawan
            </label>
          )}
          {butuhAlasan && (
            <label className="block text-xs font-semibold text-gray-700">
              Alasan *
              <textarea rows={3} required value={alasan} onChange={(e) => setAlasan(e.target.value)} className="mt-1 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500" />
            </label>
          )}
          {aksi === 'reimburse' && (
            <>
              <label className="block text-xs font-semibold text-gray-700">
                Dibayar dari
                <select value={metode} onChange={(e) => setMetode(e.target.value as 'tunai' | 'transfer')} className={`${kontrol} mt-1 w-full font-normal`}>
                  <option value="tunai">Kas Tunai</option>
                  <option value="transfer">Bank (transfer)</option>
                </select>
              </label>
              <FotoNota foto={bukti} onChange={setBukti} maks={1} label="Bukti pembayaran (opsional)" />
            </>
          )}
          {galat && <p role="alert" className="text-xs font-semibold text-red-600">{galat}</p>}
        </div>
        {aksi !== 'lihat' && (
          <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50/80 px-5 py-3.5 sm:px-8">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Kembali</button>
            <button type="submit" disabled={belumSiap || kirim} className={`rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${butuhAlasan ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {kirim ? 'Memproses…' : teks}
            </button>
          </div>
        )}
      </form>
    </Bingkai>
  );
}
