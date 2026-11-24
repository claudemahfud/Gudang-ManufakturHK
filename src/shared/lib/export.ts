// ============================================================
// EXPORT UTILITY — CSV / Excel Compatibility (RFC 4180 + UTF-8 BOM)
// Memastikan file hasil ekspor langsung terbaca rapi di Microsoft Excel,
// Google Sheets, LibreOffice tanpa karakter rusak atau tanda tanya.
// ============================================================

import { saveFile } from '@/shared/lib/simpan-berkas';

export interface ExportColumn<T> {
  header: string;
  accessor: (item: T, index: number) => string | number | null | undefined;
}

export function exportToCsv<T>(options: {
  filename: string;
  data: T[];
  columns: ExportColumn<T>[];
}) {
  const { filename, data, columns } = options;

  if (!data || data.length === 0) {
    alert('Tidak ada data yang dapat diekspor');
    return;
  }

  // 1. Baris Header
  const headerRow = columns
    .map((col) => `"${col.header.replace(/"/g, '""')}"`)
    .join(';');

  // 2. Baris Data (Format CSV dengan separator ';' untuk kompatibilitas standar Excel Indonesia)
  const bodyRows = data.map((item, index) => {
    return columns
      .map((col) => {
        const val = col.accessor(item, index);
        if (val === null || val === undefined) return '""';
        const strVal = String(val).replace(/"/g, '""');
        return `"${strVal}"`;
      })
      .join(';');
  });

  // Gabungkan dengan newline CRLF
  const csvContent = [headerRow, ...bodyRows].join('\r\n');

  // Berikan UTF-8 Byte Order Mark (\uFEFF) agar Microsoft Excel otomatis mengenali encoding UTF-8
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  const cleanFilename = filename.endsWith('.csv')
    ? filename
    : `${filename}_${timestamp}.csv`;

  saveFile(blob, cleanFilename);
}
