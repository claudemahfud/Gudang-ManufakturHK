'use client';

import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, FileText, Sparkles, X, Check } from 'lucide-react';
import { formatRupiah } from '@/shared/lib/utils';
import {
  AKUN_KAS_PILIHAN,
  dampak,
  sarankanTemplate,
  susunBaris,
  TEMPLATE,
  type Arah,
  type Template,
} from '@/shared/lib/pemetaan-akuntansi';
import { kirimJson, tglWib, type Akun } from '@/views/laporan-keuangan/util';

// ============================================================
// Catat Transaksi (pemandu pembukuan): pilih / ketik jenis transaksi dalam bahasa biasa,
// aplikasi menentukan akun COA, menampilkan pratinjau jurnal, lalu mencatatnya lewat
// endpoint yang sudah ada (kas manual, biaya operasional, jurnal manual).
// ============================================================

const KELOMPOK: { arah: Arah; judul: string; ikon: typeof ArrowDownToLine; warna: string }[] = [
  { arah: 'masuk', judul: 'Uang Masuk', ikon: ArrowDownToLine, warna: 'text-emerald-700' },
  { arah: 'keluar', judul: 'Uang Keluar', ikon: ArrowUpFromLine, warna: 'text-red-600' },
  { arah: 'nonkas', judul: 'Pencatatan Tanpa Uang', ikon: FileText, warna: 'text-blue-700' },
  { arah: 'pindah', judul: 'Pindah Kas', ikon: ArrowLeftRight, warna: 'text-amber-700' },
];

const input = 'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none bg-white';

export default function CatatTransaksi({
  akun,
  division,
  cabang,
  onTutup,
  onSelesai,
}: {
  akun: Akun[];
  division: 'MANUFAKTUR' | 'FNB';
  cabang: string;
  onTutup: () => void;
  onSelesai: (pesan: string) => void;
}) {
  const [uraian, setUraian] = useState('');
  const [pilihManual, setPilihManual] = useState<string | null>(null);
  const [akunManual, setAkunManual] = useState<string | null>(null);
  const [tanggal, setTanggal] = useState(tglWib());
  const [jumlah, setJumlah] = useState('');
  const [kas, setKas] = useState('1-1100');
  const [kasTujuan, setKasTujuan] = useState('1-1200');
  const [catatan, setCatatan] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  // Saran otomatis dari teks; pilihan manual selalu menang
  const saran = useMemo(() => sarankanTemplate(uraian), [uraian]);
  const template: Template | null = pilihManual ? TEMPLATE.find((t) => t.id === pilihManual) ?? null : saran?.template ?? null;
  const akunDipilih = akunManual ?? (pilihManual ? null : saran?.akun ?? null);
  const otomatis = !pilihManual && !!saran;

  const daftarAkun = useMemo(
    () => (template?.pilihAwalan ? akun.filter((a) => a.posting && template.pilihAwalan!.some((p) => a.kode.startsWith(p))) : []),
    [template, akun]
  );
  const akunSah = akunDipilih && daftarAkun.some((a) => a.kode === akunDipilih) ? akunDipilih : '';
  const pilihanKas = template?.rute === 'biaya' ? AKUN_KAS_PILIHAN.slice(0, 2) : AKUN_KAS_PILIHAN;
  const kasSah = pilihanKas.some((k) => k.kode === kas) ? kas : pilihanKas[0].kode;

  const baris = template ? susunBaris(template, { jumlah: Number(jumlah), kas: kasSah, akun: akunSah || undefined, kasTujuan }) : null;
  const namaAkun = (k: string) => akun.find((a) => a.kode === k)?.nama ?? k;
  const butuhKas = template && template.arah !== 'nonkas';

  const pilihTemplate = (id: string) => {
    setPilihManual(id);
    setAkunManual(null);
    setGalat(null);
  };

  const simpan = async () => {
    if (!template || !baris || proses) return;
    setProses(true);
    setGalat(null);
    const nominal = Number(jumlah);
    const lawan = template.lawan ?? akunSah;
    let hasil;
    if (template.rute === 'biaya') {
      hasil = await kirimJson('/api/biaya-operasional', {
        tanggal, akunKode: akunSah, jumlah: nominal, metode: kasSah === '1-1200' ? 'transfer' : 'tunai', keterangan: catatan || uraian || null, divisi: division, cabang,
      });
    } else if (template.rute === 'keuangan') {
      hasil = await kirimJson('/api/keuangan', {
        tanggal, jenis: template.arah, akunKode: lawan, akunKas: kasSah, jumlah: nominal, keterangan: catatan || uraian || template.label, divisi: division, cabang,
      });
    } else {
      const ket = [template.label, catatan || uraian].filter(Boolean).join(': ');
      hasil = await kirimJson('/api/akuntansi/jurnal', {
        tanggal, entitas: division, keterangan: ket, baris: baris.map((b) => ({ akunKode: b.akun, debit: b.debit, kredit: b.kredit })),
      });
    }
    setProses(false);
    if (hasil.ok) onSelesai(`${template.label} berhasil dicatat`);
    else setGalat(hasil.pesan);
  };

  const lengkap = !!baris;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg lg:max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150">
        <div className="px-6 sm:px-8 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 text-base lg:text-lg">Catat Transaksi</h2>
            <p className="text-xs text-gray-500">Pilih jenisnya, aplikasi menentukan akun & jurnalnya otomatis.</p>
          </div>
          <button type="button" onClick={onTutup} aria-label="Tutup" className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:px-8 space-y-5">
          {/* Ketik bebas */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Ceritakan transaksinya (opsional)</label>
            <div className="relative">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" aria-hidden="true" />
              <input
                value={uraian}
                onChange={(e) => {
                  setUraian(e.target.value);
                  setPilihManual(null);
                  setAkunManual(null);
                }}
                placeholder='mis. "bayar listrik PLN bulan ini", "gaji karyawan", "setoran modal awal"'
                className={`${input} pl-9`}
              />
            </div>
            {otomatis && template && (
              <p className="mt-1.5 text-xs text-emerald-700">
                Terdeteksi otomatis: <b>{template.label}</b>
                {akunSah ? <> · {namaAkun(akunSah)} ({akunSah})</> : null}. Salah? Pilih jenis lain di bawah.
              </p>
            )}
          </div>

          {/* Jenis transaksi */}
          <div className="space-y-3">
            {KELOMPOK.map((g) => (
              <div key={g.arah}>
                <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${g.warna}`}>
                  <g.ikon className="w-3.5 h-3.5" aria-hidden="true" /> {g.judul}
                </div>
                <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {TEMPLATE.filter((t) => t.arah === g.arah).map((t) => {
                    const aktif = template?.id === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => pilihTemplate(t.id)}
                        aria-pressed={aktif}
                        className={`text-left rounded-xl border px-3 py-2.5 transition ${
                          aktif ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-800">
                          {t.label}
                          {aktif && <Check className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />}
                        </span>
                        <span className="block text-[11px] text-gray-500 mt-0.5">{t.deskripsi}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Isian */}
          {template && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4 space-y-4">
              <div className="text-sm font-bold text-gray-800">{template.label}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal *</label>
                  <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={input} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nominal (Rp) *</label>
                  <input type="number" min="1" inputMode="numeric" placeholder="0" value={jumlah} onChange={(e) => setJumlah(e.target.value)} className={`${input} font-semibold text-emerald-800`} />
                </div>

                {template.pilihAwalan && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">{template.labelPilih ?? 'Akun'} *</label>
                    <select value={akunSah} onChange={(e) => setAkunManual(e.target.value)} className={input}>
                      <option value="">— Pilih —</option>
                      {daftarAkun.map((a) => (
                        <option key={a.kode} value={a.kode}>
                          {a.nama}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {butuhKas && template.arah !== 'pindah' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">{template.arah === 'masuk' ? 'Diterima ke *' : 'Dibayar dari *'}</label>
                    <div className="flex flex-wrap gap-2">
                      {pilihanKas.map((k) => (
                        <button
                          key={k.kode}
                          type="button"
                          aria-pressed={kasSah === k.kode}
                          onClick={() => setKas(k.kode)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${kasSah === k.kode ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          {k.nama}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {template.arah === 'pindah' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Dari *</label>
                      <select value={kasSah} onChange={(e) => setKas(e.target.value)} className={input}>
                        {AKUN_KAS_PILIHAN.map((k) => <option key={k.kode} value={k.kode}>{k.nama}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Ke *</label>
                      <select value={kasTujuan} onChange={(e) => setKasTujuan(e.target.value)} className={input}>
                        {AKUN_KAS_PILIHAN.map((k) => <option key={k.kode} value={k.kode}>{k.nama}</option>)}
                      </select>
                    </div>
                  </>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Keterangan</label>
                  <input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder={uraian || 'Catatan / nomor bukti (opsional)'} className={input} />
                </div>
              </div>

              {/* Pratinjau jurnal */}
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Pratinjau pembukuan</div>
                {baris ? (
                  <>
                    <table className="w-full text-sm" data-tanpa-kartu>
                      <thead className="text-[10px] uppercase tracking-wider text-gray-400 text-left">
                        <tr>
                          <th className="py-1 font-semibold">Akun</th>
                          <th className="py-1 text-right font-semibold">Debit</th>
                          <th className="py-1 text-right font-semibold">Kredit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {baris.map((b, i) => (
                          <tr key={i}>
                            <td className={`py-1.5 ${b.kredit > 0 ? 'pl-5' : ''}`}>
                              <span className="font-mono text-[11px] text-gray-400">{b.akun}</span> {namaAkun(b.akun)}
                            </td>
                            <td className="py-1.5 text-right tabular-nums">{b.debit ? formatRupiah(b.debit) : ''}</td>
                            <td className="py-1.5 text-right tabular-nums">{b.kredit ? formatRupiah(b.kredit) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
                      {dampak(baris, akun, formatRupiah).map((d) => (
                        <li key={d}>• {d}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">
                    {Number(jumlah) > 0 ? (template.pilihAwalan && !akunSah ? `Pilih ${template.labelPilih?.toLowerCase() ?? 'akun'} dulu.` : template.arah === 'pindah' ? 'Pilih kas asal dan tujuan yang berbeda.' : 'Lengkapi isian.') : 'Isi nominal untuk melihat jurnalnya.'}
                  </p>
                )}
              </div>
              {galat && <p role="alert" className="text-sm font-medium text-red-600">{galat}</p>}
            </div>
          )}
        </div>

        <div className="px-6 sm:px-8 py-3.5 border-t border-gray-100 bg-gray-50/80 flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onTutup} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-100">
            Batal
          </button>
          <button
            type="button"
            onClick={simpan}
            disabled={!lengkap || proses}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {proses ? 'Menyimpan...' : 'Catat Transaksi'}
          </button>
        </div>
      </div>
    </div>
  );
}
