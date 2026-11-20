// ============================================================
// EXPORT UTILITY — PDF (A5 / A4 Landscape) & PNG (A5) & Excel
// Mendukung:
// 1. Formulir Transaksi -> PDF Kertas A5 & PNG Kertas A5
// 2. Laporan & Rekapitulasi -> PDF Kertas A4 Landscape & Excel CSV
// ============================================================

import { exportToCsv, ExportColumn } from './export';

export { exportToCsv, type ExportColumn };

/**
 * Ekspor Formulir Transaksi ke PDF Kertas A5 (148 x 210 mm)
 */
export async function exportToPdfA5(elementOrId: HTMLElement | string, filename: string) {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (!el) {
      alert('Elemen formulir tidak ditemukan untuk diekspor ke PDF');
      return;
    }

    // Render canvas dengan resolusi tinggi (scale 2 untuk ketajaman retina/cetak)
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    // Kertas A5: 148 x 210 mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5',
      compress: true,
    });

    const pdfWidth = 148;
    const pdfHeight = 210;
    const margin = 6; // Margin 6 mm sekeliling

    const availWidth = pdfWidth - margin * 2;
    const availHeight = pdfHeight - margin * 2;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Hitung rasio skala agar gambar pas memenuhi 1 lembar A5 tanpa terpotong
    const widthRatio = availWidth / imgWidth;
    const heightRatio = availHeight / imgHeight;
    const scale = Math.min(widthRatio, heightRatio);

    const renderWidth = imgWidth * scale;
    const renderHeight = imgHeight * scale;

    // Posisikan di tengah horizontal
    const posX = margin + (availWidth - renderWidth) / 2;
    const posY = margin;

    pdf.addImage(imgData, 'JPEG', posX, posY, renderWidth, renderHeight);

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
  } catch (err) {
    console.error('Gagal mengekspor PDF A5:', err);
    alert('Terjadi kesalahan saat memproses ekspor PDF A5.');
  }
}

/**
 * Ekspor Formulir Transaksi ke Gambar PNG Kertas A5 Resolusi Tinggi
 */
export async function exportToPngA5(elementOrId: HTMLElement | string, filename: string) {
  try {
    const html2canvas = (await import('html2canvas')).default;

    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (!el) {
      alert('Elemen formulir tidak ditemukan untuk diekspor ke PNG');
      return;
    }

    const canvas = await html2canvas(el, {
      scale: 2.5, // 2.5x untuk resolusi cetak tajam
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const cleanFilename = filename.endsWith('.png') ? filename : `${filename}.png`;
    link.download = cleanFilename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Gagal mengekspor PNG A5:', err);
    alert('Terjadi kesalahan saat memproses ekspor gambar PNG.');
  }
}

/**
 * Ekspor Laporan & Rekapitulasi Data ke PDF Kertas A4 Landscape (297 x 210 mm)
 */
export async function exportReportToPdfA4Landscape(
  elementOrId: HTMLElement | string,
  filename: string,
  reportTitle?: string
) {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (!el) {
      alert('Elemen tabel laporan tidak ditemukan untuk diekspor');
      return;
    }

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    // Kertas A4 Landscape: 297 x 210 mm
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = 297;
    const pdfHeight = 210;
    const margin = 8; // Margin 8 mm

    const availWidth = pdfWidth - margin * 2;
    const availHeight = pdfHeight - margin * 2;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Rasio lebar
    const renderWidth = availWidth;
    const renderHeight = (imgHeight * renderWidth) / imgWidth;

    if (renderHeight <= availHeight) {
      // 1 Halaman Pas
      const posY = margin + (availHeight - renderHeight) / 4;
      pdf.addImage(imgData, 'JPEG', margin, posY, renderWidth, renderHeight);
    } else {
      // Multi-halaman jika tabel rekap panjang
      let heightLeft = renderHeight;
      let position = margin;
      let page = 1;

      pdf.addImage(imgData, 'JPEG', margin, position, renderWidth, renderHeight);
      heightLeft -= availHeight;

      while (heightLeft > 0) {
        position = heightLeft - renderHeight + margin;
        pdf.addPage('a4', 'landscape');
        page++;
        pdf.addImage(imgData, 'JPEG', margin, position, renderWidth, renderHeight);
        heightLeft -= availHeight;
      }
    }

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
  } catch (err) {
    console.error('Gagal mengekspor PDF A4 Landscape:', err);
    alert('Terjadi kesalahan saat memproses ekspor PDF A4 Landscape.');
  }
}
