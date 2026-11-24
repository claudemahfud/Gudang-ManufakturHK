'use client';

import React, { useState, useEffect } from 'react';
import {
  Scale,
  Wallet,
  HandCoins,
  Package,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Coffee,
  CheckCircle2,
  RefreshCw,
  Printer,
  ChevronRight,
} from 'lucide-react';
import { AksiHeader, GrupIkon, TombolIkon } from '@/shared/components/ui/AksiHeader';
import { useDivision } from '@/shared/context/DivisionContext';

export default function NeracaView() {
  // Neraca mengikuti Mode aktif saja (Manufaktur / F&B), tidak dicampur
  const { division: divisi } = useDivision();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const fetchNeraca = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/keuangan/neraca?divisi=${divisi}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNeraca();
  }, [divisi]);

  const formatRp = (val: number) => {
    return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-900 text-white">
              <Scale className="w-3.5 h-3.5 text-emerald-400" />
              Plafon Terpadu
            </span>
            <span className="text-xs text-gray-400">Pernyataan Posisi Keuangan</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Neraca Keuangan & Persediaan</h1>
          <p className="text-xs text-gray-500">
            Harmonisasi aset lancar (kas & stok persediaan), kewajiban supplier, dan ekuitas konsolidasi Manufaktur & F&B.
          </p>
        </div>

        <AksiHeader>
          <GrupIkon>
            <TombolIkon ikon={RefreshCw} label="Segarkan data" onClick={fetchNeraca} disabled={loading} putar={loading} />
            <TombolIkon ikon={Printer} label="Cetak neraca" onClick={() => window.print()} />
          </GrupIkon>
        </AksiHeader>
      </div>

      {/* Divisi mengikuti Mode aktif */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 text-xs font-semibold text-gray-800">
        {divisi === 'FNB' ? <Coffee className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
        Neraca Divisi {divisi === 'FNB' ? 'F&B' : 'Manufaktur'}
      </div>

      {/* KPI Cards Ringkasan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Aset */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Total Aset (Aktiva)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {formatRp(data?.aset?.totalAset || 0)}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Kas & bank + valuasi total stok gudang</p>
        </div>

        {/* Total Kewajiban */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Total Kewajiban (Hutang)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {formatRp(data?.kewajiban?.totalKewajiban || 0)}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Hutang supplier & tempo pengadaan</p>
        </div>

        {/* Total Ekuitas */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Ekuitas Bersih (Modal & Laba)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">
            {formatRp(data?.ekuitas?.totalEkuitas || 0)}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Nilai bersih setelah dipotong kewajiban</p>
        </div>
      </div>

      {/* Grid Detail Neraca: Aset vs Kewajiban & Ekuitas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kolom Kiri: ASET */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <h2 className="font-bold text-gray-900 text-sm">ASET (AKTIVA)</h2>
            </div>
            <span className="text-xs font-mono font-bold text-gray-900 whitespace-nowrap shrink-0">
              {formatRp(data?.aset?.totalAset || 0)}
            </span>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Aset Lancar
            </div>

            {/* Saldo Kas & Bank */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-3 min-w-0">
                <Wallet className="w-4 h-4 text-gray-500" />
                <div>
                  <div className="text-xs font-bold text-gray-800">Kas & Setara Kas (Bank)</div>
                  <div className="text-[11px] text-gray-400">Total likuiditas di kasir & rekening operasional</div>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-gray-900 whitespace-nowrap shrink-0">
                {formatRp(data?.aset?.kasBank || 0)}
              </span>
            </div>

            {/* Piutang Usaha (Faktur Penjualan belum lunas) */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-3 min-w-0">
                <HandCoins className="w-4 h-4 text-gray-500" />
                <div>
                  <div className="text-xs font-bold text-gray-800">Piutang Usaha</div>
                  <div className="text-[11px] text-gray-400">Sisa tagihan faktur penjualan ke pelanggan</div>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-gray-900 whitespace-nowrap shrink-0">
                {formatRp(data?.aset?.piutangUsaha || 0)}
              </span>
            </div>

            {/* Persediaan Stok Gudang */}
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Package className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="text-xs font-bold text-gray-800">Persediaan Barang Dagang & Bahan Baku</div>
                    <div className="text-[11px] text-gray-400">Nilai modal HPP barang aktif di gudang</div>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-gray-900 whitespace-nowrap shrink-0">
                  {formatRp(data?.aset?.persediaan || 0)}
                </span>
              </div>

                          </div>

            <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs font-bold text-gray-900">
              <span>Total Aset Lancar</span>
              <span className="font-mono whitespace-nowrap shrink-0">{formatRp(data?.aset?.totalAsetLancar || 0)}</span>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: KEWAJIBAN & EKUITAS */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm space-y-6">
          {/* KEWAJIBAN */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h2 className="font-bold text-gray-900 text-sm">KEWAJIBAN (LIABILITAS)</h2>
              </div>
              <span className="text-xs font-mono font-bold text-gray-900 whitespace-nowrap shrink-0">
                {formatRp(data?.kewajiban?.totalKewajiban || 0)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div>
                <div className="text-xs font-bold text-gray-800">Hutang Usaha & Supplier</div>
                <div className="text-[11px] text-gray-400">Kewajiban tempo pengadaan bahan mentah & logistik</div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-700 whitespace-nowrap shrink-0">
                {formatRp(data?.kewajiban?.hutangUsaha || 0)}
              </span>
            </div>
          </div>

          {/* EKUITAS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h2 className="font-bold text-gray-900 text-sm">EKUITAS BERSIH</h2>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700 whitespace-nowrap shrink-0">
                {formatRp(data?.ekuitas?.totalEkuitas || 0)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
              <div>
                <div className="text-xs font-bold text-emerald-950">Modal Disetor & Laba Ditahan</div>
                <div className="text-[11px] text-emerald-700">Kekayaan bersih konsolidasi perusahaan</div>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-800 whitespace-nowrap shrink-0">
                {formatRp(data?.ekuitas?.modalDanLaba || 0)}
              </span>
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs font-bold text-gray-900">
              <span>Total Kewajiban + Ekuitas</span>
              <span className="font-mono whitespace-nowrap shrink-0">
                {formatRp((data?.kewajiban?.totalKewajiban || 0) + (data?.ekuitas?.totalEkuitas || 0))}
              </span>
            </div>
          </div>

          {/* Balance Indicator */}
          <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Keseimbangan Neraca (Balance Check)</span>
            </div>
            <span className="text-xs font-bold text-emerald-400">
              {data?.balanceCheck ? 'SEIMBANG (100% MATCH)' : 'SEDANG DISINKRONISASI'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
