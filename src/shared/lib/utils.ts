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
 * Generate nomor transaksi unik
 */
export function generateTrxId(prefix: string = 'TRX'): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
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
