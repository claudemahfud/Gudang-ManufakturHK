// ============================================================
// Simpan berkas (PNG / PDF / CSV) yang dibuat aplikasi: satu helper untuk semua fitur.
// - Unduh lewat blob URL (BUKAN data URL / pdf.save): Safari iOS membuka data URL, tidak mengunduh.
// - PDF/CSV dikirim sebagai octet-stream agar tidak dibuka di penampil browser (Safari iOS, Chrome Android).
// - Layar sentuh yang mendukung Web Share berkas: tampil dialog "File siap" (ShareSheet) dengan tombol
//   Bagikan/Simpan. navigator.share WAJIB dipanggil langsung dari klik, bukan setelah await render,
//   jadi tombolnya ada di dialog terpisah.
// ============================================================

export const SHARE_EVENT = 'app:share-file';

export function saveFile(blob: Blob, name: string) {
  const mentah = blob.type.startsWith('image/') ? blob : new Blob([blob], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(mentah);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Jangan dicabut langsung: Safari butuh waktu membaca blob
  setTimeout(() => URL.revokeObjectURL(url), 60_000);

  // Hanya layar sentuh: di desktop unduhan biasa sudah cukup
  if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) window.dispatchEvent(new CustomEvent(SHARE_EVENT, { detail: file }));
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal membuat gambar.'))), type, quality)
  );
}
