'use client';

import React, { useRef, useState } from 'react';
import { Download, Image as ImageIcon, Printer, X, FileText, CheckCircle2 } from 'lucide-react';
import { formatTanggal, formatRupiah } from '@/shared/lib/utils';
import { exportToPdfA5, exportToPngA5 } from '@/shared/lib/exportDoc';

export type DocumentType = 'po_loading' | 'faktur_penjualan' | 'faktur_mutasi' | 'formulir_return';

export interface DocumentItemLine {
  sku: string;
  namaBarang: string;
  brand?: string | null;
  qty: number;
  satuan: string;
  harga?: number | string | null;
  total?: number | string | null;
  keterangan?: string | null;
}

export interface DocumentData {
  type: DocumentType;
  nomor: string;
  tanggal: string;
  divisi?: string;
  cabang?: string;
  // Pihak terkait
  pihakTerkaitLabel?: string; // e.g. "Suplier Pemasok:", "Pelanggan / Toko:", "Cabang Tujuan:", "Unit Pelapor:"
  pihakTerkaitNama: string;
  kontakInfo?: string | null;
  // Petugas
  petugasLabel?: string; // e.g. "Petugas Gudang", "Salesman", "Driver / Armada"
  petugasNama?: string | null;
  noFakturRef?: string | null;
  skemaBayar?: string | null;
  jatuhTempo?: string | null;
  // Items
  items: DocumentItemLine[];
  // Finansial / Ringkasan
  totalNilai?: number | null;
  /** Rincian di bawah tabel (mis. Faktur Penjualan: subtotal, diskon, PPN, ongkir, dibayar, sisa). Menggantikan baris total tunggal. */
  ringkasan?: { label: string; nilai: number; tegas?: boolean }[];
  catatan?: string | null;
  alasanReturn?: string | null;
  tindakanReturn?: string | null;
}

interface DocumentModalViewerProps {
  data: DocumentData | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DocumentModalViewer({ data, isOpen, onClose }: DocumentModalViewerProps) {
  const [exporting, setExporting] = useState<'pdf' | 'png' | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !data) return null;

  // Title configuration
  const getDocumentMeta = () => {
    switch (data.type) {
      case 'po_loading':
        return {
          title: 'PURCHASE ORDER & LOADING SHEET',
          subtitle: 'BUKTI PENERIMAAN BARANG MASUK DARI SUPLIER',
          filenamePrefix: `PO_LOADING_${data.nomor}`,
          sig1: 'Diserahkan (Suplier)',
          sig2: 'Driver / Ekspedisi',
          sig3: 'Diterima (Kepala Gudang)',
        };
      case 'faktur_penjualan':
        return {
          title: 'FAKTUR PENJUALAN GROSIR B2B',
          subtitle: 'SURAT JALAN & DELIVERY INVOICE PENJUALAN',
          filenamePrefix: `FAKTUR_PENJUALAN_${data.nomor}`,
          sig1: 'Admin Penjualan',
          sig2: 'Supir / Logistik',
          sig3: 'Penerima / Pelanggan',
        };
      case 'faktur_mutasi':
        return {
          title: 'FAKTUR MUTASI ANTAR CABANG',
          subtitle: 'SURAT JALAN & TRANSFER ORDER STOCK SHEET',
          filenamePrefix: `FAKTUR_MUTASI_${data.nomor}`,
          sig1: 'Pengirim (Cabang Asal)',
          sig2: 'Pengangkut / Armada',
          sig3: 'Penerima (Cabang Tujuan)',
        };
      case 'formulir_return':
        return {
          title: 'BERITA ACARA & FORMULIR RETURN',
          subtitle: 'PENCATATAN BARANG RUSAK, AFKIR & RETURN SUPLIER',
          filenamePrefix: `RETURN_${data.nomor}`,
          sig1: 'Yang Mengajukan',
          sig2: 'Quality Control (QC)',
          sig3: 'Pimpinan / Kepala Gudang',
        };
      default:
        return {
          title: 'DOKUMEN TRANSAKSI RESMI',
          subtitle: 'GUDANG MANUFAKTUR & F&B HUB',
          filenamePrefix: `DOC_${data.nomor}`,
          sig1: 'Pembuat',
          sig2: 'Pemeriksa',
          sig3: 'Penyetuju',
        };
    }
  };

  const meta = getDocumentMeta();

  const handleExportPdf = async () => {
    if (!docRef.current) return;
    setExporting('pdf');
    try {
      await exportToPdfA5(docRef.current, meta.filenamePrefix);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPng = async () => {
    if (!docRef.current) return;
    setExporting('png');
    try {
      await exportToPngA5(docRef.current, meta.filenamePrefix);
    } finally {
      setExporting(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden border border-gray-200 print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full animate-in fade-in zoom-in-95 duration-200">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="px-5 py-3.5 bg-gray-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold flex items-center gap-2">
                <span>{meta.title}</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Kertas A5 (148 &times; 210 mm)
                </span>
              </div>
              <p className="text-[11px] text-gray-400">Nomor: {data.nomor} &bull; Siap diekspor ke PDF / PNG atau dicetak langsung</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export PDF A5 */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-xs font-semibold shadow-xs transition"
              title="Download Dokumen Format PDF Kertas A5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting === 'pdf' ? 'Mengekspor...' : 'Export PDF (A5)'}</span>
            </button>

            {/* Export PNG A5 */}
            <button
              type="button"
              onClick={handleExportPng}
              disabled={exporting !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-semibold shadow-xs transition"
              title="Download Dokumen Gambar PNG Kertas A5 Resolusi Tinggi"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{exporting === 'png' ? 'Mengekspor...' : 'Export PNG (A5)'}</span>
            </button>

            {/* Cetak Langsung */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-semibold border border-gray-700 transition"
              title="Cetak langsung ke printer (Ukuran Kertas A5)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cetak</span>
            </button>

            {/* Tutup */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition ml-1"
              aria-label="Tutup Pratinjau Dokumen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Document Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          {/* A5 Printable Paper Sheet (148 x 210 mm proportion) */}
          <div
            ref={docRef}
            id="printable-a5-document"
            className="w-full max-w-[148mm] min-h-[210mm] bg-white p-6 sm:p-7 shadow-lg border border-gray-200 text-gray-800 flex flex-col justify-between print:shadow-none print:border-none print:p-4 print:max-w-none print:w-full print:min-h-0"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            <div>
              {/* 1. Header Perusahaan & Kop Surat */}
              <div className="flex items-start justify-between border-b-2 border-gray-900 pb-3">
                <div className="space-y-0.5">
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-gray-900 uppercase">
                    GUDANG MANUFAKTUR &amp; F&amp;B HUB
                  </h1>
                  <p className="text-[10px] text-gray-600 font-medium">
                    Sistem Manajemen Logistik, Inventaris &amp; Distribusi Terpadu
                  </p>
                  <p className="text-[9px] text-gray-500">
                    Kawasan Pergudangan Sentral No. 88 &bull; Telp/WA: (021) 8899-7700 &bull; Cabang: {data.cabang || 'Pusat'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-gray-900 text-white">
                    {data.divisi || 'MANUFAKTUR'}
                  </span>
                  <div className="text-[9px] text-gray-400 mt-1 font-mono">FORM-A5-STD</div>
                </div>
              </div>

              {/* 2. Judul Formulir Dokumen */}
              <div className="text-center my-3">
                <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-gray-900 underline decoration-1 underline-offset-2">
                  {meta.title}
                </h2>
                <p className="text-[9px] font-semibold text-gray-600 tracking-wider mt-0.5">
                  {meta.subtitle}
                </p>
              </div>

              {/* 3. Metadata Dokumen & Pihak Terkait (Grid 2 Kolom) */}
              <div className="grid grid-cols-2 gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-[10px] mb-3">
                <div className="space-y-1">
                  <div className="flex">
                    <span className="w-24 text-gray-500 font-medium">Nomor Dokumen</span>
                    <span className="font-bold font-mono text-gray-900">: {data.nomor}</span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-gray-500 font-medium">Tanggal Transaksi</span>
                    <span className="font-semibold text-gray-800">: {formatTanggal(data.tanggal)}</span>
                  </div>
                  {data.noFakturRef && (
                    <div className="flex">
                      <span className="w-24 text-gray-500 font-medium">No. Ref / Faktur</span>
                      <span className="font-mono text-gray-800">: {data.noFakturRef}</span>
                    </div>
                  )}
                  {data.skemaBayar && (
                    <div className="flex items-center">
                      <span className="w-24 text-gray-500 font-medium">Skema Bayar</span>
                      <span className="font-bold uppercase text-gray-900">
                        : {data.skemaBayar === 'hutang'
                          ? 'Hutang (Tempo)'
                          : data.skemaBayar === 'lunas'
                            ? 'Bayar Lunas (Kas)'
                            : data.skemaBayar}
                        {data.jatuhTempo && (
                          <span className="text-[9px] font-normal text-amber-800 ml-1">
                            (Jatuh tempo: {formatTanggal(data.jatuhTempo)})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1 border-l border-gray-200 pl-3">
                  <div className="flex">
                    <span className="w-24 text-gray-500 font-medium">
                      {data.pihakTerkaitLabel || 'Pihak Terkait'}
                    </span>
                    <span className="font-bold text-gray-900">: {data.pihakTerkaitNama}</span>
                  </div>
                  {data.kontakInfo && (
                    <div className="flex">
                      <span className="w-24 text-gray-500 font-medium">Alamat / Telp</span>
                      <span className="text-gray-700">: {data.kontakInfo}</span>
                    </div>
                  )}
                  {data.petugasNama && (
                    <div className="flex">
                      <span className="w-24 text-gray-500 font-medium">{data.petugasLabel || 'Petugas'}</span>
                      <span className="font-medium text-gray-800">: {data.petugasNama}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Tabel Rincian Barang (Standar Cetak A5) */}
              <div className="border border-gray-300 rounded overflow-hidden mb-3">
                <table className="w-full text-[9px] text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300 text-gray-700 uppercase font-bold">
                      <th className="py-1.5 px-2 w-7 text-center">No</th>
                      <th className="py-1.5 px-2">SKU</th>
                      <th className="py-1.5 px-2">Nama Barang &amp; Spesifikasi</th>
                      <th className="py-1.5 px-2 text-center w-16">Jumlah</th>
                      {data.totalNilai !== undefined && data.totalNilai !== null && (
                        <>
                          <th className="py-1.5 px-2 text-right w-20">Harga</th>
                          <th className="py-1.5 px-2 text-right w-24">Subtotal</th>
                        </>
                      )}
                      {data.type === 'formulir_return' && (
                        <th className="py-1.5 px-2 text-left">Penyebab / Alasan</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-800">
                    {data.items.map((it, idx) => {
                      const harga = Number(it.harga) || 0;
                      const subtotal = Number(it.total) || it.qty * harga;
                      return (
                        <tr key={idx} className="leading-tight">
                          <td className="py-1.5 px-2 text-center text-gray-500">{idx + 1}</td>
                          <td className="py-1.5 px-2 font-mono font-bold text-gray-900">{it.sku}</td>
                          <td className="py-1.5 px-2">
                            <span className="font-semibold text-gray-900">{it.namaBarang}</span>
                            {it.brand && <span className="text-gray-500 ml-1">({it.brand})</span>}
                            {it.keterangan && <div className="text-[8px] text-gray-500">{it.keterangan}</div>}
                          </td>
                          <td className="py-1.5 px-2 text-center font-bold text-gray-900 whitespace-nowrap">
                            {it.qty} {it.satuan}
                          </td>
                          {data.totalNilai !== undefined && data.totalNilai !== null && (
                            <>
                              <td className="py-1.5 px-2 text-right whitespace-nowrap">{formatRupiah(harga)}</td>
                              <td className="py-1.5 px-2 text-right font-bold whitespace-nowrap">
                                {formatRupiah(subtotal)}
                              </td>
                            </>
                          )}
                          {data.type === 'formulir_return' && (
                            <td className="py-1.5 px-2 text-gray-700 italic text-[8.5px]">
                              {it.keterangan || data.alasanReturn || 'Cacat / Rusak'}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  {data.totalNilai !== undefined && data.totalNilai !== null && (
                    <tfoot>
                      {data.ringkasan?.length ? (
                        data.ringkasan.map((r, i) => (
                          <tr
                            key={r.label}
                            className={`bg-gray-50 ${i === 0 ? 'border-t-2 border-gray-300' : ''} ${
                              r.tegas ? 'font-bold text-gray-900' : 'text-gray-700'
                            }`}
                          >
                            <td colSpan={5} className="py-1 px-2 text-right uppercase text-[9px]">
                              {r.label}:
                            </td>
                            <td
                              className={`py-1 px-2 text-right whitespace-nowrap ${
                                r.tegas ? 'text-[10px] text-emerald-800 font-black' : 'text-[9px]'
                              }`}
                            >
                              {r.nilai < 0 ? `- ${formatRupiah(-r.nilai)}` : formatRupiah(r.nilai)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold text-gray-900">
                          <td colSpan={5} className="py-1.5 px-2 text-right uppercase text-[9px]">
                            Total Nilai Transaksi:
                          </td>
                          <td className="py-1.5 px-2 text-right text-[10px] text-emerald-800 font-black">
                            {formatRupiah(data.totalNilai)}
                          </td>
                        </tr>
                      )}
                    </tfoot>
                  )}
                </table>
              </div>

              {/* 5. Catatan Tambahan / Instruksi Khusus */}
              {(data.catatan || data.alasanReturn || data.tindakanReturn) && (
                <div className="p-2 rounded bg-gray-50 border border-gray-200 text-[8.5px] text-gray-700 mb-3 space-y-0.5">
                  {data.catatan && (
                    <div>
                      <strong>Catatan Operasional:</strong> {data.catatan}
                    </div>
                  )}
                  {data.alasanReturn && (
                    <div>
                      <strong>Alasan Kerusakan / Retur:</strong> {data.alasanReturn}
                    </div>
                  )}
                  {data.tindakanReturn && (
                    <div>
                      <strong>Tindakan Disetujui:</strong> {data.tindakanReturn}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 6. Kotak Tanda Tangan Resmi (3 Pihak) */}
            <div className="pt-3 border-t border-gray-300">
              <div className="grid grid-cols-3 gap-3 text-center text-[9px] text-gray-700">
                <div>
                  <div className="font-semibold">{meta.sig1}</div>
                  <div className="h-12 border-b border-gray-300 mb-1" />
                  <div className="text-[8px] text-gray-500">( Nama &amp; Cap )</div>
                </div>
                <div>
                  <div className="font-semibold">{meta.sig2}</div>
                  <div className="h-12 border-b border-gray-300 mb-1" />
                  <div className="text-[8px] text-gray-500">( Tanda Tangan )</div>
                </div>
                <div>
                  <div className="font-semibold">{meta.sig3}</div>
                  <div className="h-12 border-b border-gray-300 mb-1" />
                  <div className="text-[8px] text-gray-500">( Pimpinan / Otorisasi )</div>
                </div>
              </div>
              <div className="mt-2 text-center text-[7.5px] text-gray-400">
                Dokumen ini merupakan bukti transaksi operasional gudang yang sah dan telah tercatat dalam sistem terpadu.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
