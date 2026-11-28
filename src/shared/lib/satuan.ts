// ============================================================
// HELPER: Satuan Barang Terhubung (Master Inventory <-> Semua Menu)
// Hanya dua satuan resmi yang terhubung konversi stok: 'pcs' dan 'karton'.
// ============================================================

export type SatuanBarang = 'pcs' | 'karton';

export interface InfoSatuanProduk {
  gramasi?: string | null;
  pakaiKarton?: boolean | null;
  settingPcs?: number | string | null;
  hargaBeli?: number | string | null;
  hargaBeliKarton?: number | string | null;
  hargaJual?: number | string | null;
}

/**
 * Ambil satuan dasar dari Master Inventory (mis. "1 kg" -> "kg", "1 liter" -> "liter", "500 gram" -> "pcs").
 */
export function satuanDasarOf(produk?: { gramasi?: string | null } | null): string {
  const s = String(produk?.gramasi ?? '').trim();
  if (!s) return 'pcs';
  const m = s.replace(',', '.').match(/^([\d.]+)\s*(.+)$/);
  if (m) {
    const angka = parseFloat(m[1]);
    const unit = m[2].trim().toLowerCase();
    if (angka === 1 && unit) {
      if (unit === 'g' || unit === 'gr') return 'gram';
      if (unit === 'l' || unit === 'lt') return 'liter';
      if (unit === 'bks') return 'bungkus';
      return unit;
    }
    return 'pcs';
  }
  return s.toLowerCase();
}

const ALIAS_KARTON = new Set(['karton', 'krt', 'ctn', 'dus', 'dos', 'box']);

/** Normalisasi input satuan ke 'pcs' atau 'karton'. */
export function normalizeSatuan(raw: unknown): SatuanBarang {
  const s = String(raw ?? '').trim().toLowerCase();
  return ALIAS_KARTON.has(s) ? 'karton' : 'pcs';
}

/**
 * Jumlah pcs dalam 1 karton berdasarkan Master Inventory.
 * Mengembalikan 0 jika produk tidak mengaktifkan satuan karton (atau settingPcs <= 1).
 */
export function isiKartonOf(produk?: InfoSatuanProduk | null): number {
  if (!produk?.pakaiKarton) return 0;
  const n = Number(produk.settingPcs);
  return Number.isFinite(n) && n > 1 ? Math.floor(n) : 0;
}

/**
 * Ambil harga beli atau harga jual sesuai satuan yang dipilih.
 * - 'pcs': harga per pcs
 * - 'karton': hargaBeliKarton (jika diisi > 0) atau hargaPerPcs * isiKarton
 */
export function hargaUntukSatuan(
  produk: InfoSatuanProduk | null | undefined,
  satuan: SatuanBarang,
  tipe: 'beli' | 'jual'
): number {
  if (!produk) return 0;
  const isi = isiKartonOf(produk);
  if (tipe === 'beli') {
    const hargaPcs = Number(produk.hargaBeli) || 0;
    if (satuan === 'karton' && isi > 1) {
      const krt = Number(produk.hargaBeliKarton) || 0;
      return krt > 0 ? krt : Math.round(hargaPcs * isi);
    }
    return hargaPcs;
  }
  const hargaPcs = Number(produk.hargaJual) || 0;
  if (satuan === 'karton' && isi > 1) {
    return Math.round(hargaPcs * isi);
  }
  return hargaPcs;
}
