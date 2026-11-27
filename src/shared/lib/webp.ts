import sharp from 'sharp';
import { BusinessError } from '@/shared/lib/stock';

// Server saja. Semua gambar unggahan disimpan sebagai WebP. Dikonversi di server karena
// Safari (iPhone) tidak bisa membuat WebP di browser. Sekaligus memastikan isinya benar
// gambar dan membuang metadata (mis. lokasi GPS dari kamera HP).

const POLA = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/;

export interface OpsiWebp {
  lebar: number;
  tinggi: number;
  /** 'inside' = muat dalam kotak (rasio tetap); 'cover' = potong tengah memenuhi kotak */
  fit: 'inside' | 'cover';
  mutu: number;
}

export async function keWebp(dataUrl: string, o: OpsiWebp): Promise<string> {
  const isi = POLA.exec(dataUrl)?.[2];
  if (!isi) throw new BusinessError('Format foto harus JPG, PNG, atau WebP');
  try {
    const gambar = sharp(Buffer.from(isi, 'base64'), { limitInputPixels: 16_000_000 });
    // sharp membaca format dari isinya: SVG/GIF/TIFF berlabel image/png tidak diterima
    const { format } = await gambar.metadata();
    if (!['jpeg', 'png', 'webp'].includes(format ?? '')) throw new Error('format');
    const hasil = await gambar
      .rotate() // terapkan orientasi EXIF sebelum metadata dibuang
      .resize({ width: o.lebar, height: o.tinggi, fit: o.fit, withoutEnlargement: o.fit === 'inside' })
      .webp({ quality: o.mutu })
      .toBuffer();
    return `data:image/webp;base64,${hasil.toString('base64')}`;
  } catch {
    throw new BusinessError('Foto rusak atau tidak bisa dibaca');
  }
}
