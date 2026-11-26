import { ArrowRight, Banknote, CheckCircle2, HandCoins, ShoppingBag } from 'lucide-react';

// Penjelasan singkat alur setoran, agar jelas ini setoran uang penjualan (bukan setoran modal).
const LANGKAH = [
  { ikon: ShoppingBag, judul: '1. Sales menjual tunai', isi: 'Lewat Kasir POS atau faktur memakai akun sales.' },
  { ikon: HandCoins, judul: '2. Uang dipegang sales', isi: 'Otomatis tercatat sebagai Kas di Tangan Sales.' },
  { ikon: Banknote, judul: '3. Setor ke Finance', isi: 'Sales mengajukan setoran: tunai diserahkan atau transfer.' },
  { ikon: CheckCircle2, judul: '4. Finance konfirmasi', isi: 'Setelah uang diterima, baru masuk Kas / Bank perusahaan.' },
];

export default function CaraKerja({ terbuka }: { terbuka: boolean }) {
  return (
    <details open={terbuka} className="group rounded-2xl border border-gray-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-bold text-gray-900">
        Cara kerja setoran
        <ArrowRight className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <ol className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
        {LANGKAH.map((l) => (
          <li key={l.judul} className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
            <l.ikon className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            <p className="mt-2 text-sm font-bold text-gray-900">{l.judul}</p>
            <p className="mt-0.5 text-xs text-gray-600">{l.isi}</p>
          </li>
        ))}
      </ol>
      <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
        Transfer / QRIS dari pelanggan langsung masuk rekening perusahaan; Finance mencocokkannya di Verifikasi Transfer.
      </p>
    </details>
  );
}
