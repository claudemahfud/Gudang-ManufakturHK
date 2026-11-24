'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftRight, CheckCircle2, Printer, RefreshCw, Scale, TrendingUp, XCircle } from 'lucide-react';
import { formatRupiah, formatTanggal } from '@/shared/lib/utils';
import { useDivision } from '@/shared/context/DivisionContext';
import { AksiHeader, GrupIkon, TombolIkon } from '@/shared/components/ui/AksiHeader';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';
import { ambil, kontrol, KotakTerlarang, PilihPeriode, rentangPreset, rpLaporan, tglWib } from './util';

// ============================================================
// PAGE: Laporan Keuangan (Neraca, Laba Rugi, Arus Kas metode langsung)
// Route: /laporan-keuangan?tab=neraca|laba-rugi|arus-kas
// Per perusahaan (Mode aktif), tanpa konsolidasi.
// ============================================================

type Tab = 'neraca' | 'laba-rugi' | 'arus-kas';
const TAB: { kunci: Tab; label: string; ikon: typeof Scale }[] = [
  { kunci: 'neraca', label: 'Neraca', ikon: Scale },
  { kunci: 'laba-rugi', label: 'Laba Rugi', ikon: TrendingUp },
  { kunci: 'arus-kas', label: 'Arus Kas', ikon: ArrowLeftRight },
];

interface Kelompok {
  nama: string;
  akun: { kode: string; nama: string; saldo: number }[];
  total: number;
}
interface DataNeraca {
  entitas: string;
  per: string;
  aset: Kelompok[];
  kewajiban: Kelompok[];
  ekuitas: Kelompok[];
  totalAset: number;
  totalKewajiban: number;
  totalEkuitas: number;
  labaBerjalan: number;
  seimbang: boolean;
  selisih: number;
  nilaiPersediaanFisik: number;
  persediaanBuku: number;
}
interface BarisLR {
  kode: string;
  nama: string;
  jumlah: number;
}
interface DataLabaRugi {
  dari: string;
  sampai: string;
  pendapatan: BarisLR[];
  totalPendapatan: number;
  pengurang: BarisLR[];
  totalPengurang: number;
  pendapatanBersih: number;
  hpp: BarisLR[];
  totalHpp: number;
  labaKotor: number;
  bebanOperasional: BarisLR[];
  totalBebanOperasional: number;
  labaOperasional: number;
  pendapatanLain: BarisLR[];
  bebanLain: BarisLR[];
  lainBersih: number;
  labaBersih: number;
  marginKotor: number | null;
  marginBersih: number | null;
}
interface BagianKas {
  baris: { uraian: string; jumlah: number }[];
  total: number;
}
interface DataArusKas {
  dari: string;
  sampai: string;
  saldoAwal: number;
  operasi: BagianKas;
  investasi: BagianKas;
  pendanaan: BagianKas;
  kenaikanBersih: number;
  saldoAkhir: number;
  saldoAkhirBuku: number;
  cocok: boolean;
  perAkun: { kode: string; nama: string; saldoAwal: number; saldoAkhir: number }[];
}

const namaEntitas = (e: string) => (e === 'FNB' ? 'F&B' : 'Manufaktur');

// ---------- Baris laporan ----------

function Angka({ v, tebal }: { v: number; tebal?: boolean }) {
  return (
    <span className={`whitespace-nowrap tabular-nums text-right ${v < 0 ? 'text-red-600' : ''} ${tebal ? 'font-bold' : ''}`}>
      {rpLaporan(v)}
    </span>
  );
}

function Judul({ children }: { children: React.ReactNode }) {
  return <div className="pt-4 pb-1 text-xs font-extrabold uppercase tracking-wider text-gray-900">{children}</div>;
}

function SubJudul({ children }: { children: React.ReactNode }) {
  return <div className="pt-2 pb-0.5 pl-3 text-xs font-bold text-gray-700">{children}</div>;
}

function Akun({ kode, nama, v }: { kode?: string; nama: string; v: number }) {
  return (
    // HP: nominal turun ke bawah nama akun; layar lebar & cetak: sejajar di kanan
    <div className="py-1 pl-6 text-sm text-gray-700 break-inside-avoid sm:flex sm:items-baseline sm:gap-2">
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        {kode ? <span className="w-14 shrink-0 font-mono text-[11px] text-gray-400">{kode}</span> : <span className="w-14 shrink-0" />}
        <span className="min-w-0 flex-1">{nama}</span>
      </div>
      <div className="pl-16 font-semibold text-gray-900 sm:pl-0 sm:font-normal sm:text-gray-700">
        <Angka v={v} />
      </div>
    </div>
  );
}

function Subtotal({ label, v }: { label: string; v: number }) {
  return (
    <div className="py-1.5 pl-3 text-sm font-semibold text-gray-900 sm:flex sm:items-baseline sm:gap-2">
      <div className="min-w-0 flex-1">{label}</div>
      <span className="mt-0.5 inline-block border-t border-gray-400 pt-1 sm:mt-0">
        <Angka v={v} />
      </span>
    </div>
  );
}

function Total({ label, v, ganda }: { label: string; v: number; ganda?: boolean }) {
  return (
    <div className="py-2 text-sm font-extrabold text-gray-900 sm:flex sm:items-baseline sm:gap-2">
      <div className="min-w-0 flex-1 uppercase">{label}</div>
      <span className={`mt-0.5 inline-block border-t border-gray-900 pt-1 sm:mt-0 ${ganda ? 'border-b-4 border-double pb-0.5' : ''}`}>
        <Angka v={v} tebal />
      </span>
    </div>
  );
}

function Kosong() {
  return <div className="py-1 pl-6 text-xs italic text-gray-400">Tidak ada saldo</div>;
}

function Lencana({ baik, children }: { baik: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
        baik ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {baik ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

/** Kertas laporan: kop (judul, perusahaan, periode) + isi. */
function Kertas({ judul, entitas, periode, children }: { judul: string; entitas: string; periode: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-8 print:max-w-none print:border-0 print:p-0 print:shadow-none">
      <header className="border-b-2 border-gray-900 pb-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Perusahaan {namaEntitas(entitas)}</p>
        <h2 className="text-lg font-extrabold text-gray-900">{judul}</h2>
        <p className="text-xs text-gray-600">{periode}</p>
      </header>
      {children}
    </article>
  );
}

/** Muat data laporan; versi dinaikkan untuk muat ulang. */
function useLaporan<T>(url: string, versi: number) {
  const kunci = `${url}#${versi}`;
  const [state, setState] = useState<{ kunci: string; data: T | null; galat: string | null; terlarang: boolean }>({
    kunci: '',
    data: null,
    galat: null,
    terlarang: false,
  });
  useEffect(() => {
    let batal = false;
    ambil<T>(url).then((h) => {
      if (batal) return;
      if (h.ok) setState({ kunci, data: h.data, galat: null, terlarang: false });
      else setState((s) => ({ ...s, kunci, galat: h.pesan, terlarang: h.terlarang }));
    });
    return () => {
      batal = true;
    };
  }, [url, kunci]);
  return { ...state, memuat: state.kunci !== kunci };
}

function Status({ memuat, galat, terlarang, ada }: { memuat: boolean; galat: string | null; terlarang: boolean; ada: boolean }) {
  if (terlarang) return <KotakTerlarang />;
  if (memuat && !ada)
    return (
      <div className="flex justify-center rounded-2xl border border-gray-100 bg-white py-14">
        <MemuatProgres teks="Menyusun laporan..." />
      </div>
    );
  if (galat && !ada) return <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{galat}</p>;
  return null;
}

// ---------- Tab Neraca ----------

function BagianNeraca({ kelompok }: { kelompok: Kelompok[] }) {
  return (
    <>
      {kelompok.map((k) => (
        <div key={k.nama}>
          <SubJudul>{k.nama}</SubJudul>
          {k.akun.length === 0 ? <Kosong /> : k.akun.map((a) => <Akun key={a.kode || a.nama} kode={a.kode} nama={a.nama} v={a.saldo} />)}
          <Subtotal label={`Total ${k.nama}`} v={k.total} />
        </div>
      ))}
    </>
  );
}

function TabNeraca({ entitas, per, versi }: { entitas: string; per: string; versi: number }) {
  const s = useLaporan<DataNeraca>(`/api/akuntansi/neraca?entitas=${entitas}&per=${per}`, versi);
  const d = s.data;
  if (!d) return <Status {...s} ada={false} />;
  const selisihPersediaan = d.nilaiPersediaanFisik - d.persediaanBuku;
  return (
    <div className={`space-y-3 transition-opacity ${s.memuat ? 'opacity-60' : ''}`}>
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 print:hidden">
        <Lencana baik={d.seimbang}>{d.seimbang ? 'Seimbang' : `Tidak seimbang (selisih ${formatRupiah(Math.abs(d.selisih))})`}</Lencana>
      </div>
      <Kertas judul="Neraca" entitas={d.entitas} periode={`Per ${formatTanggal(d.per)}`}>
        <Judul>Aset</Judul>
        <BagianNeraca kelompok={d.aset} />
        <Total label="Total Aset" v={d.totalAset} ganda />

        <Judul>Kewajiban</Judul>
        <BagianNeraca kelompok={d.kewajiban} />
        <Total label="Total Kewajiban" v={d.totalKewajiban} />

        <Judul>Ekuitas</Judul>
        <BagianNeraca kelompok={d.ekuitas} />
        <Total label="Total Ekuitas" v={d.totalEkuitas} />

        <Total label="Total Kewajiban & Ekuitas" v={d.totalKewajiban + d.totalEkuitas} ganda />

        <p className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
          Nilai persediaan fisik (stok × HPP): <strong className="tabular-nums text-gray-900">{formatRupiah(d.nilaiPersediaanFisik)}</strong>
          {' · '}Persediaan di buku: <strong className="tabular-nums text-gray-900">{formatRupiah(d.persediaanBuku)}</strong>
          {Math.round(selisihPersediaan) !== 0 && (
            <span className="font-semibold text-amber-700"> · Selisih {rpLaporan(selisihPersediaan)}</span>
          )}
        </p>
      </Kertas>
    </div>
  );
}

// ---------- Tab Laba Rugi ----------

function Daftar({ baris }: { baris: BarisLR[] }) {
  if (baris.length === 0) return <Kosong />;
  return (
    <>
      {baris.map((b) => (
        <Akun key={b.kode || b.nama} kode={b.kode} nama={b.nama} v={b.jumlah} />
      ))}
    </>
  );
}

const persen = (v: number | null) => (v === null ? '–' : `${v.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`);

function TabLabaRugi({ entitas, dari, sampai, versi }: { entitas: string; dari: string; sampai: string; versi: number }) {
  const s = useLaporan<DataLabaRugi>(`/api/akuntansi/laba-rugi?entitas=${entitas}&dari=${dari}&sampai=${sampai}`, versi);
  const d = s.data;
  if (!d) return <Status {...s} ada={false} />;
  return (
    <div className={`space-y-3 transition-opacity ${s.memuat ? 'opacity-60' : ''}`}>
      <Kertas judul="Laporan Laba Rugi" entitas={entitas} periode={`Periode ${formatTanggal(d.dari)} s.d. ${formatTanggal(d.sampai)}`}>
        <Judul>Pendapatan</Judul>
        <Daftar baris={d.pendapatan} />
        <Subtotal label="Total Pendapatan" v={d.totalPendapatan} />
        {(d.pengurang.length > 0 || d.totalPengurang !== 0) && (
          <>
            <SubJudul>Dikurangi: Retur & Potongan</SubJudul>
            <Daftar baris={d.pengurang} />
            <Subtotal label="Total Pengurang" v={d.totalPengurang} />
          </>
        )}
        <Total label="Pendapatan Bersih" v={d.pendapatanBersih} />

        <Judul>Harga Pokok Penjualan</Judul>
        <Daftar baris={d.hpp} />
        <Subtotal label="Total HPP" v={d.totalHpp} />
        <Total label="Laba Kotor" v={d.labaKotor} />

        <Judul>Beban Operasional</Judul>
        <Daftar baris={d.bebanOperasional} />
        <Subtotal label="Total Beban Operasional" v={d.totalBebanOperasional} />
        <Total label="Laba Operasional" v={d.labaOperasional} />

        <Judul>Pendapatan & Beban Lain-lain</Judul>
        {d.pendapatanLain.length > 0 && <SubJudul>Pendapatan Lain-lain</SubJudul>}
        <Daftar baris={d.pendapatanLain} />
        {d.bebanLain.length > 0 && <SubJudul>Beban Lain-lain</SubJudul>}
        <Daftar baris={d.bebanLain} />
        <Subtotal label="Pendapatan (Beban) Lain Bersih" v={d.lainBersih} />

        <Total label="Laba (Rugi) Bersih" v={d.labaBersih} ganda />

        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-xs">
          <div>
            <dt className="text-gray-500">Margin Kotor</dt>
            <dd className="text-base font-bold tabular-nums text-gray-900">{persen(d.marginKotor)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Margin Bersih</dt>
            <dd className={`text-base font-bold tabular-nums ${(d.marginBersih ?? 0) < 0 ? 'text-red-600' : 'text-gray-900'}`}>{persen(d.marginBersih)}</dd>
          </div>
        </dl>
      </Kertas>
    </div>
  );
}

// ---------- Tab Arus Kas ----------

function SeksiKas({ judul, b, labelTotal }: { judul: string; b: BagianKas; labelTotal: string }) {
  return (
    <>
      <Judul>{judul}</Judul>
      {b.baris.length === 0 ? <Kosong /> : b.baris.map((x, i) => <Akun key={i} nama={x.uraian} v={x.jumlah} />)}
      <Subtotal label={labelTotal} v={b.total} />
    </>
  );
}

function TabArusKas({ entitas, dari, sampai, versi }: { entitas: string; dari: string; sampai: string; versi: number }) {
  const s = useLaporan<DataArusKas>(`/api/akuntansi/arus-kas?entitas=${entitas}&dari=${dari}&sampai=${sampai}`, versi);
  const d = s.data;
  if (!d) return <Status {...s} ada={false} />;
  return (
    <div className={`space-y-3 transition-opacity ${s.memuat ? 'opacity-60' : ''}`}>
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 print:hidden">
        <Lencana baik={d.cocok}>
          {d.cocok ? 'Cocok dengan saldo kas di buku' : `Tidak cocok: saldo kas di buku ${formatRupiah(d.saldoAkhirBuku)}`}
        </Lencana>
      </div>
      <Kertas judul="Laporan Arus Kas (Metode Langsung)" entitas={entitas} periode={`Periode ${formatTanggal(d.dari)} s.d. ${formatTanggal(d.sampai)}`}>
        <div className="pt-4 text-sm font-bold text-gray-900 sm:flex sm:items-baseline sm:gap-2">
          <div className="min-w-0 flex-1">Saldo Kas & Setara Kas Awal Periode</div>
          <Angka v={d.saldoAwal} tebal />
        </div>
        <SeksiKas judul="Arus Kas dari Aktivitas Operasi" b={d.operasi} labelTotal="Kas Bersih dari Aktivitas Operasi" />
        <SeksiKas judul="Arus Kas dari Aktivitas Investasi" b={d.investasi} labelTotal="Kas Bersih dari Aktivitas Investasi" />
        <SeksiKas judul="Arus Kas dari Aktivitas Pendanaan" b={d.pendanaan} labelTotal="Kas Bersih dari Aktivitas Pendanaan" />
        <Total label="Kenaikan (Penurunan) Bersih Kas" v={d.kenaikanBersih} />
        <Total label="Saldo Kas & Setara Kas Akhir Periode" v={d.saldoAkhir} ganda />

        {d.perAkun.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl bg-gray-50 p-3" data-tanpa-kartu>
            <table className="w-full text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="py-1 pr-2">Akun Kas</th>
                  <th className="py-1 px-2 text-right">Saldo Awal</th>
                  <th className="py-1 pl-2 text-right">Saldo Akhir</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {d.perAkun.map((a) => (
                  <tr key={a.kode}>
                    <td className="py-1 pr-2">
                      <span className="font-mono text-gray-400">{a.kode}</span> {a.nama}
                    </td>
                    <td className="py-1 px-2 text-right"><Angka v={a.saldoAwal} /></td>
                    <td className="py-1 pl-2 text-right"><Angka v={a.saldoAkhir} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kertas>
    </div>
  );
}

// ---------- Halaman ----------

export default function LaporanKeuangan() {
  const { division } = useDivision();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get('tab');
  const tab: Tab = q === 'laba-rugi' || q === 'arus-kas' ? q : 'neraca';

  const [per, setPer] = useState(tglWib());
  const [periode, setPeriode] = useState(rentangPreset('bulan-ini'));
  const [versi, setVersi] = useState(0);

  const pilihTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

  return (
    <div data-cetak-laporan className="space-y-5 print:space-y-0">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Laporan Keuangan</h1>
          <p className="mt-1 text-sm text-gray-500">
            Neraca, laba rugi & arus kas perusahaan {namaEntitas(division)} dari jurnal pembukuan
          </p>
        </div>
        <AksiHeader>
          <GrupIkon>
            <TombolIkon ikon={RefreshCw} label="Muat ulang" onClick={() => setVersi((v) => v + 1)} />
            <TombolIkon ikon={Printer} label="Cetak" onClick={() => window.print()} />
          </GrupIkon>
        </AksiHeader>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 lg:flex-row lg:items-end lg:justify-between print:hidden">
        <div role="tablist" aria-label="Jenis laporan" className="flex gap-1.5 overflow-x-auto">
          {TAB.map((t) => (
            <button
              key={t.kunci}
              type="button"
              role="tab"
              aria-selected={tab === t.kunci}
              onClick={() => pilihTab(t.kunci)}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition ${
                tab === t.kunci ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <t.ikon className="h-4 w-4" aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'neraca' ? (
          <label className="text-xs font-semibold text-gray-600">
            Per tanggal
            <input type="date" value={per} onChange={(e) => e.target.value && setPer(e.target.value)} className={`${kontrol} mt-1 block`} />
          </label>
        ) : (
          <PilihPeriode dari={periode.dari} sampai={periode.sampai} ubah={setPeriode} />
        )}
      </div>

      <div role="tabpanel">
        {tab === 'neraca' && <TabNeraca entitas={division} per={per} versi={versi} />}
        {tab === 'laba-rugi' && <TabLabaRugi entitas={division} dari={periode.dari} sampai={periode.sampai} versi={versi} />}
        {tab === 'arus-kas' && <TabArusKas entitas={division} dari={periode.dari} sampai={periode.sampai} versi={versi} />}
      </div>
    </div>
  );
}
