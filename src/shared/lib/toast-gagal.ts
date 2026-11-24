// ============================================================
// Toast kegagalan global: semua kegagalan (respons API tidak sukses, jaringan putus, error tak
// terduga) tampil sebagai toast melayang 5 detik lalu hilang, lengkap dengan keterangannya.
// Penangkap dipasang sekali di window.fetch (lihat ToastGagal.tsx) sehingga semua halaman tercakup.
// ============================================================

export const EVENT_GAGAL = 'app:gagal';
export const DURASI_TOAST_MS = 5000;

export interface InfoGagal {
  judul: string;
  pesan: string;
}

/** Bagian pesan yang tidak boleh sampai ke layar (SQL mentah, jejak tumpukan, kredensial). */
const MENTAH = /failed query|select .+ from |insert into|update .+ set |delete from|postgres|econn|emaxconn|stack|at \S+ \(|password|token/i;

export const PESAN_DB = 'Gangguan database sementara. Coba lagi sebentar lagi.';

/** Pastikan pesan aman & ringkas ditampilkan ke pengguna. */
export function bersihkanPesan(teks: unknown): string {
  const t = String(teks ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (/emaxconn|max clients|failed query|postgres|econn/i.test(t)) return PESAN_DB;
  if (MENTAH.test(t)) return 'Terjadi kesalahan sistem. Coba lagi nanti.';
  return t.length > 220 ? `${t.slice(0, 217)}...` : t;
}

const JUDUL_METODE: Record<string, string> = {
  GET: 'Gagal memuat data',
  POST: 'Gagal menyimpan',
  PUT: 'Gagal memperbarui',
  PATCH: 'Gagal memperbarui',
  DELETE: 'Gagal menghapus',
};

const PESAN_STATUS: Record<number, string> = {
  400: 'Data yang dikirim tidak valid.',
  401: 'Sesi Anda berakhir. Silakan login ulang.',
  403: 'Akses ditolak. Akun Anda tidak berhak melakukan ini.',
  404: 'Data tidak ditemukan (mungkin sudah dihapus).',
  405: 'Aksi tidak diizinkan.',
  408: 'Permintaan terlalu lama. Coba lagi.',
  409: 'Data bentrok dengan perubahan lain. Muat ulang lalu coba lagi.',
  413: 'Data terlalu besar.',
  422: 'Data tidak dapat diproses.',
  429: 'Terlalu banyak permintaan. Tunggu sebentar.',
  500: 'Terjadi kesalahan server. Coba lagi nanti.',
  502: 'Server sedang tidak dapat dihubungi. Coba lagi nanti.',
  503: 'Server sedang sibuk. Coba lagi nanti.',
  504: 'Server terlalu lama merespons. Coba lagi nanti.',
};

/** Susun judul & keterangan dari respons API yang gagal. `body` = JSON respons bila ada. */
export function ringkasGagal(status: number, metode: string, body: unknown): InfoGagal {
  const judul = JUDUL_METODE[metode.toUpperCase()] ?? 'Permintaan gagal';
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const utama = bersihkanPesan(b.message ?? b.error);
  const sebab = bersihkanPesan(b.penyebab);
  const dasar = utama || PESAN_STATUS[status] || (status >= 500 ? PESAN_STATUS[500] : `Kesalahan ${status}.`);
  return { judul, pesan: sebab && sebab !== dasar ? `${dasar} ${sebab}` : dasar };
}

export function infoJaringan(): InfoGagal {
  return { judul: 'Tidak ada koneksi', pesan: 'Server tidak dapat dihubungi. Periksa internet Anda lalu coba lagi.' };
}

/** Tampilkan toast kegagalan dari kode mana pun: tampilkanGagal('Judul', 'Keterangan'). */
export function tampilkanGagal(judul: string, pesan: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<InfoGagal>(EVENT_GAGAL, { detail: { judul, pesan: bersihkanPesan(pesan) || pesan } }));
}

/** Permintaan yang tidak perlu menampilkan toast (polling latar, autentikasi, atau ditandai senyap). */
export function perluDiabaikan(url: string, init?: RequestInit | Request): boolean {
  let path = url;
  try {
    path = new URL(url, window.location.origin).pathname;
    if (new URL(url, window.location.origin).origin !== window.location.origin) return true;
  } catch {
    return true;
  }
  if (!path.startsWith('/api/')) return true;
  if (path.startsWith('/api/auth/') || path === '/api/notifikasi') return true;
  const h = init && 'headers' in init ? (init.headers as HeadersInit | undefined) : undefined;
  return !!h && new Headers(h).has('x-senyap');
}
