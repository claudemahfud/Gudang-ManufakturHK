'use client';

// ============================================================
// COMPONENT: DateTimeFilterBar
// Filter Custom Fleksibel: Rentang Jam, Hari, Minggu, Bulan, Tahun
// ============================================================

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Filter, RotateCcw, Check } from 'lucide-react';

export type TimePreset =
  | 'ALL'
  | 'TODAY'
  | 'YESTERDAY'
  | '7DAYS'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR'
  | 'CUSTOM';

export interface DateTimeFilterBarProps {
  onFilterChange: (startIso: string, endIso: string, label: string) => void;
  initialPreset?: TimePreset;
  className?: string;
}

export default function DateTimeFilterBar({
  onFilterChange,
  initialPreset = 'ALL',
  className = '',
}: DateTimeFilterBarProps) {
  const [preset, setPreset] = useState<TimePreset>(initialPreset);
  const [startDateTime, setStartDateTime] = useState<string>('');
  const [endDateTime, setEndDateTime] = useState<string>('');
  const [filterLabel, setFilterLabel] = useState<string>('Semua Waktu');

  // Format Date object to `YYYY-MM-DDTHH:mm` local string
  const formatLocalIso = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const applyPreset = (selectedPreset: TimePreset) => {
    setPreset(selectedPreset);
    const now = new Date();

    if (selectedPreset === 'ALL') {
      setStartDateTime('');
      setEndDateTime('');
      setFilterLabel('Semua Waktu');
      onFilterChange('', '', 'Semua Waktu');
      return;
    }

    if (selectedPreset === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const sStr = formatLocalIso(start);
      const eStr = formatLocalIso(end);
      const label = `Hari Ini (${start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})`;
      setStartDateTime(sStr);
      setEndDateTime(eStr);
      setFilterLabel(label);
      onFilterChange(sStr, eStr, label);
      return;
    }

    if (selectedPreset === 'YESTERDAY') {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      const start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0);
      const end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59);
      const sStr = formatLocalIso(start);
      const eStr = formatLocalIso(end);
      const label = `Kemarin (${start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})`;
      setStartDateTime(sStr);
      setEndDateTime(eStr);
      setFilterLabel(label);
      onFilterChange(sStr, eStr, label);
      return;
    }

    if (selectedPreset === '7DAYS') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const sStr = formatLocalIso(start);
      const eStr = formatLocalIso(end);
      const label = `7 Hari Terakhir (${start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})`;
      setStartDateTime(sStr);
      setEndDateTime(eStr);
      setFilterLabel(label);
      onFilterChange(sStr, eStr, label);
      return;
    }

    if (selectedPreset === 'THIS_WEEK') {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const sStr = formatLocalIso(monday);
      const eStr = formatLocalIso(end);
      const label = `Minggu Ini (${monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})`;
      setStartDateTime(sStr);
      setEndDateTime(eStr);
      setFilterLabel(label);
      onFilterChange(sStr, eStr, label);
      return;
    }

    if (selectedPreset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const sStr = formatLocalIso(start);
      const eStr = formatLocalIso(end);
      const label = `Bulan Ini (${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})`;
      setStartDateTime(sStr);
      setEndDateTime(eStr);
      setFilterLabel(label);
      onFilterChange(sStr, eStr, label);
      return;
    }

    if (selectedPreset === 'LAST_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      const sStr = formatLocalIso(start);
      const eStr = formatLocalIso(end);
      const label = `Bulan Lalu (${start.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})`;
      setStartDateTime(sStr);
      setEndDateTime(eStr);
      setFilterLabel(label);
      onFilterChange(sStr, eStr, label);
      return;
    }

    if (selectedPreset === 'THIS_YEAR') {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      const sStr = formatLocalIso(start);
      const eStr = formatLocalIso(end);
      const label = `Tahun Ini (${now.getFullYear()})`;
      setStartDateTime(sStr);
      setEndDateTime(eStr);
      setFilterLabel(label);
      onFilterChange(sStr, eStr, label);
      return;
    }

    if (selectedPreset === 'CUSTOM') {
      // Keep existing inputs or initialize with today
      if (!startDateTime) {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        setStartDateTime(formatLocalIso(start));
      }
      if (!endDateTime) {
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        setEndDateTime(formatLocalIso(end));
      }
    }
  };

  const handleCustomApply = () => {
    if (!startDateTime && !endDateTime) {
      applyPreset('ALL');
      return;
    }
    const label = `Rentang Bebas: ${startDateTime ? startDateTime.replace('T', ' ') : 'Awal'} s/d ${endDateTime ? endDateTime.replace('T', ' ') : 'Sekarang'}`;
    setPreset('CUSTOM');
    setFilterLabel(label);
    onFilterChange(startDateTime, endDateTime, label);
  };

  const handleReset = () => {
    applyPreset('ALL');
  };

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3.5 ${className}`}>
      {/* 1. Baris Preset Waktu Cepat */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span>Filter Periode:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'ALL', label: 'Semua Waktu' },
            { id: 'TODAY', label: 'Hari Ini' },
            { id: 'YESTERDAY', label: 'Kemarin' },
            { id: '7DAYS', label: '7 Hari' },
            { id: 'THIS_WEEK', label: 'Minggu Ini' },
            { id: 'THIS_MONTH', label: 'Bulan Ini' },
            { id: 'LAST_MONTH', label: 'Bulan Lalu' },
            { id: 'THIS_YEAR', label: 'Tahun Ini' },
            { id: 'CUSTOM', label: 'Custom Jam & Tanggal' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyPreset(item.id as TimePreset)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                preset === item.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80 hover:text-gray-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Baris Custom Input Rentang Tanggal & Jam */}
      <div className="pt-2 border-t border-gray-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-200">
            <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-gray-500 font-medium">Mulai:</span>
            <input
              type="datetime-local"
              value={startDateTime}
              onChange={(e) => {
                setStartDateTime(e.target.value);
                setPreset('CUSTOM');
              }}
              className="bg-transparent text-gray-800 font-semibold focus:outline-none text-xs"
            />
          </div>

          <span className="text-gray-400 font-semibold">s/d</span>

          <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-200">
            <Clock className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span className="text-gray-500 font-medium">Sampai:</span>
            <input
              type="datetime-local"
              value={endDateTime}
              onChange={(e) => {
                setEndDateTime(e.target.value);
                setPreset('CUSTOM');
              }}
              className="bg-transparent text-gray-800 font-semibold focus:outline-none text-xs"
            />
          </div>

          <button
            type="button"
            onClick={handleCustomApply}
            className="inline-flex items-center gap-1 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-xs"
            title="Terapkan Rentang Waktu Custom"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Terapkan</span>
          </button>

          {(startDateTime || endDateTime || preset !== 'ALL') && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-semibold transition"
              title="Reset ke Semua Waktu"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Badge status filter aktif */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-medium text-[11px] self-start md:self-auto">
          <Filter className="w-3 h-3 text-emerald-600" />
          <span>Status: <strong className="font-bold">{filterLabel}</strong></span>
        </div>
      </div>
    </div>
  );
}
