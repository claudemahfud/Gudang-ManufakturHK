// ============================================================
// UTILS — Helper functions shared across pages
// ============================================================

/**
 * Format angka ke format rupiah
 */
export function formatRupiah(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'Rp 0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format tanggal ke format Indonesia
 */
export function formatTanggal(date: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...options,
  });
}

/**
 * Format tanggal pendek: DD/MM/YYYY
 */
export function formatTanggalPendek(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format tanggal dan waktu: DD/MM/YYYY HH:mm WIB
 */
export function formatTanggalWaktu(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  const tgl = d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const jam = d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${tgl} ${jam} WIB`;
}

/**
 * Format stok dengan satuan karton/pcs
 */
export function formatStok(stok: number, pakaiKarton: boolean, settingPcs: number): string {
  if (!pakaiKarton || settingPcs <= 1) return `${stok} pcs`;
  const karton = Math.floor(stok / settingPcs);
  const sisa = stok % settingPcs;
  if (sisa === 0) return `${karton} krt`;
  return `${karton} krt ${sisa} pcs`;
}

/**
 * Baca gramasi master ("500g", "1 kg", "1000ml", "1,5 L") menjadi gram atau ml per pcs.
 * Satuan lain ("16oz", "1pcs") dikembalikan null: tidak dihitung beratnya.
 */
export function bacaGramasi(gramasi?: string | null): { nilai: number; jenis: 'berat' | 'volume' } | null {
  const m = String(gramasi ?? '').trim().toLowerCase().replace(',', '.').match(/^([\d.]+)\s*(g|gr|gram|kg|ml|l|lt|liter)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = m[2];
  if (u === 'kg') return { nilai: n * 1000, jenis: 'berat' };
  if (u === 'l' || u === 'lt' || u === 'liter') return { nilai: n * 1000, jenis: 'volume' };
  return { nilai: n, jenis: u === 'ml' ? 'volume' : 'berat' };
}

/** Tampilkan berat/volume: "500 g", "10 kg (10.000 g)", "1,5 liter (1.500 ml)". */
export function formatBerat(nilai: number, jenis: 'berat' | 'volume'): string {
  const kecil = jenis === 'berat' ? 'g' : 'ml';
  const besar = jenis === 'berat' ? 'kg' : 'liter';
  const fmt = (x: number) => x.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  if (nilai < 1000) return `${fmt(nilai)} ${kecil}`;
  return `${fmt(nilai / 1000)} ${besar} (${fmt(nilai)} ${kecil})`;
}

/**
 * Generate nomor transaksi unik
 */
export function generateTrxId(prefix: string = 'TRX'): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  // 6 byte acak kriptografis (12 hex): peluang bentrok praktis nol, beda dari
  // 3 digit Math.random() lama yang mudah bentrok saat transaksi ramai.
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  const random = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${prefix}-${date}-${time}-${random}`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Truncate text
 */
export function truncate(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * SHA-256 hash (browser-safe via SubtleCrypto)
 */
export async function sha256Browser(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
