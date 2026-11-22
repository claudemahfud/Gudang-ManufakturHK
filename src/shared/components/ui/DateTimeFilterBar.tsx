'use client';

// ============================================================
// COMPONENT: DateTimeFilterBar
// Satu tombol filter periode: preset cepat, kalender rentang 2 bulan,
// dan jam mulai/selesai. Perubahan baru diterapkan saat tombol "Proses".
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

export type TimePreset =
  | 'ALL'
  | 'TODAY'
  | 'YESTERDAY'
  | '7DAYS'
  | 'THIS_WEEK'
  | 'LAST_WEEK'
  | '30DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR'
  | 'CUSTOM';

export interface DateTimeFilterBarProps {
  /** startIso/endIso: `YYYY-MM-DDTHH:mm` waktu lokal, atau '' untuk Semua Waktu */
  onFilterChange: (startIso: string, endIso: string, label: string) => void;
  initialPreset?: TimePreset;
  className?: string;
}

interface Range {
  preset: TimePreset;
  start: Date | null;
  end: Date | null;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

const PRESETS: { id: Exclude<TimePreset, 'CUSTOM'>; label: string }[] = [
  { id: 'ALL', label: 'Semua Waktu' },
  { id: 'TODAY', label: 'Hari Ini' },
  { id: 'YESTERDAY', label: 'Kemarin' },
  { id: '7DAYS', label: '7 Hari Terakhir' },
  { id: 'THIS_WEEK', label: 'Minggu Ini' },
  { id: 'LAST_WEEK', label: 'Minggu Lalu' },
  { id: '30DAYS', label: '30 Hari Terakhir' },
  { id: 'THIS_MONTH', label: 'Bulan Ini' },
  { id: 'LAST_MONTH', label: 'Bulan Lalu' },
  { id: 'THIS_YEAR', label: 'Tahun Ini' },
];

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const pad = (n: number) => String(n).padStart(2, '0');
const dayOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && a.getTime() === b.getTime();
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtShort = (d: Date) => d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtLong = (d: Date) => d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
const monthTitle = (d: Date) => d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

function presetRange(preset: TimePreset): Pick<Range, 'start' | 'end'> {
  const today = dayOnly(new Date());
  const y = today.getFullYear();
  const m = today.getMonth();
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  switch (preset) {
    case 'TODAY':
      return { start: today, end: today };
    case 'YESTERDAY':
      return { start: addDays(today, -1), end: addDays(today, -1) };
    case '7DAYS':
      return { start: addDays(today, -6), end: today };
    case 'THIS_WEEK':
      return { start: monday, end: today };
    case 'LAST_WEEK':
      return { start: addDays(monday, -7), end: addDays(monday, -1) };
    case '30DAYS':
      return { start: addDays(today, -29), end: today };
    case 'THIS_MONTH':
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
    case 'LAST_MONTH':
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
    case 'THIS_YEAR':
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
    default:
      return { start: null, end: null };
  }
}

const fromPreset = (preset: TimePreset): Range => ({
  preset,
  ...presetRange(preset),
  startTime: '00:00',
  endTime: '23:59',
});

function rangeText(r: Range, fmt: (d: Date) => string): string {
  if (!r.start) return 'Semua Waktu';
  const end = r.end ?? r.start;
  const custom = r.startTime !== '00:00' || r.endTime !== '23:59';
  const s = `${fmt(r.start)}${custom ? ` ${r.startTime}` : ''}`;
  const e = `${fmt(end)}${custom ? ` ${r.endTime}` : ''}`;
  return sameDay(r.start, end) && !custom ? s : `${s} - ${e}`;
}

function buildLabel(r: Range): string {
  if (!r.start) return 'Semua Waktu';
  const preset = PRESETS.find((p) => p.id === r.preset);
  const text = rangeText(r, fmtShort);
  return preset ? `${preset.label} (${text})` : text;
}

function MonthGrid({
  month,
  draft,
  today,
  onPick,
}: {
  month: Date;
  draft: Range;
  today: Date;
  onPick: (d: Date) => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  const end = draft.end ?? draft.start;
  const multi = !!draft.start && !!end && !sameDay(draft.start, end);

  return (
    <div role="grid" aria-label={monthTitle(month)} className="grid grid-cols-7 gap-y-1 text-center text-xs">
      {DAY_NAMES.map((n) => (
        <div key={n} className="py-1 font-semibold text-gray-500">
          {n}
        </div>
      ))}
      {cells.map((d, i) => {
        if (!d) return <div key={`e${i}`} />;
        const isStart = sameDay(d, draft.start);
        const isEnd = sameDay(d, end);
        const inRange = !!draft.start && !!end && d > draft.start && d < end;
        const isEdge = isStart || isEnd;
        const band = inRange
          ? 'bg-emerald-50'
          : multi && isStart
            ? 'bg-gradient-to-r from-transparent from-50% to-emerald-50 to-50%'
            : multi && isEnd
              ? 'bg-gradient-to-l from-transparent from-50% to-emerald-50 to-50%'
              : '';
        return (
          <div key={ymd(d)} className={`flex justify-center ${band}`}>
            <button
              type="button"
              onClick={() => onPick(d)}
              aria-label={fmtLong(d)}
              aria-pressed={isEdge}
              className={`h-8 w-8 rounded-full font-medium tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                isEdge
                  ? 'bg-emerald-600 font-bold text-white'
                  : inRange
                    ? 'text-emerald-900 hover:bg-emerald-100'
                    : `${d.getDay() === 0 ? 'text-gray-400' : 'text-gray-800'} hover:bg-gray-100`
              } ${sameDay(d, today) && !isEdge ? 'ring-1 ring-emerald-500' : ''}`}
            >
              {d.getDate()}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function DateTimeFilterBar({
  onFilterChange,
  initialPreset = 'ALL',
  className = '',
}: DateTimeFilterBarProps) {
  const [applied, setApplied] = useState<Range>(() => fromPreset(initialPreset));
  const [draft, setDraft] = useState<Range>(applied);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => leftMonthFor(applied));
  const rootRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => dayOnly(new Date()), []);

  // Tutup saat klik di luar / tombol Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openPicker = () => {
    setDraft(applied);
    setViewMonth(leftMonthFor(applied));
    setOpen(true);
  };

  const pickPreset = (preset: TimePreset) => {
    const next = fromPreset(preset);
    setDraft(next);
    setViewMonth(leftMonthFor(next));
  };

  const pickDay = (d: Date) => {
    setDraft((p) => {
      // Klik pertama (atau setelah rentang lengkap) = tanggal mulai baru
      if (!p.start || p.end) return { ...p, preset: 'CUSTOM', start: d, end: null };
      return d < p.start
        ? { ...p, preset: 'CUSTOM', start: d, end: p.start }
        : { ...p, preset: 'CUSTOM', end: d };
    });
  };

  const apply = () => {
    const r: Range = draft.start && !draft.end ? { ...draft, end: draft.start } : draft;
    setApplied(r);
    setOpen(false);
    if (!r.start || !r.end) {
      onFilterChange('', '', 'Semua Waktu');
      return;
    }
    onFilterChange(`${ymd(r.start)}T${r.startTime}`, `${ymd(r.end)}T${r.endTime}`, buildLabel(r));
  };

  const rightMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
  const shiftMonth = (n: number) => setViewMonth((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));
  const navBtn = 'rounded-lg p-1 text-gray-700 hover:bg-gray-100';

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl border border-emerald-500 bg-white px-3.5 py-2 text-sm font-medium text-gray-800 shadow-xs transition hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <Calendar className="h-4 w-4 text-gray-700" />
        <span className="tabular-nums">{rangeText(applied, fmtShort)}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Pilih periode"
          className="absolute left-0 top-full z-50 mt-2 w-[min(860px,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white shadow-xl"
        >
          <div className="flex flex-col md:flex-row">
            {/* Preset cepat */}
            <ul className="flex gap-1 overflow-x-auto border-b border-gray-100 p-2 md:w-40 md:shrink-0 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:py-3">
              {PRESETS.map((p) => (
                <li key={p.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => pickPreset(p.id)}
                    className={`w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
                      draft.preset === p.id
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>

            {/* Kalender: 1 bulan di layar kecil, 2 bulan di layar lebar */}
            <div className="flex min-w-0 flex-1 gap-6 p-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-2">
                  <button type="button" onClick={() => shiftMonth(-1)} aria-label="Bulan sebelumnya" className={navBtn}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-bold capitalize text-gray-900">{monthTitle(viewMonth)}</span>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    aria-label="Bulan berikutnya"
                    className={`${navBtn} lg:invisible`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <MonthGrid month={viewMonth} draft={draft} today={today} onPick={pickDay} />
              </div>
              <div className="hidden min-w-0 flex-1 lg:block">
                <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="w-6" />
                  <span className="text-sm font-bold capitalize text-gray-900">{monthTitle(rightMonth)}</span>
                  <button type="button" onClick={() => shiftMonth(1)} aria-label="Bulan berikutnya" className={navBtn}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <MonthGrid month={rightMonth} draft={draft} today={today} onPick={pickDay} />
              </div>
            </div>

            {/* Rincian tanggal & jam */}
            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 p-4 md:w-48 md:shrink-0 md:grid-cols-1 md:content-start md:border-l md:border-t-0">
              {(
                [
                  ['Dari', draft.start, 'startTime'],
                  ['Hingga', draft.end ?? draft.start, 'endTime'],
                ] as const
              ).map(([lbl, date, key]) => (
                <div key={key} className="space-y-2">
                  <div>
                    <div className="text-xs font-semibold text-gray-700">{lbl} Tanggal</div>
                    <div className="text-xs text-gray-400">{date ? fmtLong(date) : 'Semua'}</div>
                  </div>
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-700">{lbl} Pukul</span>
                    <span className="mt-1 flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 focus-within:border-emerald-500">
                      <Clock className="h-4 w-4 shrink-0 text-gray-600" />
                      <input
                        type="time"
                        disabled={!draft.start}
                        value={draft[key]}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) setDraft((p) => ({ ...p, [key]: v }));
                        }}
                        className="w-full bg-transparent text-sm font-semibold tabular-nums text-gray-800 focus:outline-none disabled:text-gray-400 [&::-webkit-calendar-picker-indicator]:hidden"
                      />
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold tabular-nums text-gray-800">{rangeText(draft, fmtLong)}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={apply}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Proses
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Bulan kiri kalender: di layar lebar (2 panel) bulan sebelum tanggal akhir; di layar kecil bulan tanggal akhir */
function leftMonthFor(r: Range): Date {
  const base = r.end ?? new Date();
  const twoPanels = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
  return new Date(base.getFullYear(), base.getMonth() - (twoPanels ? 1 : 0), 1);
}
