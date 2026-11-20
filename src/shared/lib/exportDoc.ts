// ============================================================
// EXPORT UTILITY — PDF RESMI (KOP SURAT A4 LANDSCAPE & A5) & PNG & EXCEL
// Mendukung:
// 1. Rekapitulasi & Laporan -> PDF Kertas A4 Landscape dengan KOP SURAT RESMI Lengkap
// 2. Formulir Transaksi -> PDF Kertas A5 & PNG Kertas A5
// 3. Rekap Data -> Excel CSV (UTF-8 BOM)
// ============================================================

import { exportToCsv, ExportColumn } from './export';

export { exportToCsv, type ExportColumn };

export interface RekapPdfOptions {
  title: string;
  nomorDokumen?: string;
  divisi?: string;
  cabang?: string;
  periodeFilter?: string;
  operator?: string;
  columns: string[];
  rows: (string | number)[][];
  columnStyles?: Record<number, any>;
  summaryFooter?: (string | number)[];
  catatan?: string;
  filename?: string;
}

/**
 * Ekspor Rekapitulasi Laporan ke PDF Kertas A4 Landscape (297 x 210 mm)
 * DENGAN KOP SURAT RESMI LENGKAP & SEGALA INSTRUMEN PEMBENTUK KOP
 */
export async function exportRekapToPdfA4Landscape(options: RekapPdfOptions) {
  try {
    const jspdfMod = await import('jspdf');
    const autoTableMod = await import('jspdf-autotable');

    const jsPDF = jspdfMod.jsPDF || (jspdfMod as any).default;
    const autoTable = autoTableMod.default || autoTableMod;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
    const margin = 12; // 12 mm margin
    const contentWidth = pageWidth - margin * 2; // 273 mm

    // ============================================================
    // 1. KOP SURAT RESMI DENGAN INSTRUMEN LENGKAP
    // ============================================================
    // A. Logo Emblem Badge (Kiri)
    doc.setFillColor(5, 150, 105); // Emerald-600
    doc.roundedRect(margin, 8, 15, 15, 2.5, 2.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('HK', margin + 7.5, 17, { align: 'center' });

    // B. Header Teks Utama Kop Surat
    const textStartX = margin + 18;

    // Nama Lembaga / Brand Usaha
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text('GUDANG MANUFAKTUR & F&B HUB INDONESIA', textStartX, 12);

    // Badan Hukum Resmi
    doc.setFontSize(9);
    doc.setTextColor(5, 150, 105); // Emerald-600
    doc.text(
      'PT. HIKIMORI KARYA MANUFAKTUR • SISTEM PERGUDANGAN & DISTRIBUSI TERPADU',
      textStartX,
      16.5
    );

    // Deskripsi Bidang Usaha & Izin
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); // Slate-600
    doc.text(
      'Pusat Pergudangan Bahan Baku, Pabrikasi Manufaktur, Distribusi B2B & Supply Chain Food & Beverages',
      textStartX,
      20.5
    );

    // Alamat, Kontak Resmi & Legalitas
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(
      'Kawasan Industri Terpadu Blok HK No. 88, Jawa Timur | Telp: (031) 8899-7700 | Email: operasional@gudangmanufaktur.id | Web: gudang-manufaktur.vercel.app',
      textStartX,
      24
    );

    // Nomor Legalitas (NIB & NPWP) di sebelah kanan
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(51, 65, 85);
    doc.text('LEGALITAS RESMI PERUSAHAAN', margin + contentWidth, 12, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text('NIB: 9120008892183', margin + contentWidth, 16, { align: 'right' });
    doc.text('NPWP: 01.889.776.4-604.000', margin + contentWidth, 19.5, { align: 'right' });
    doc.text('Izin Kemenkumham: AHU-0028911', margin + contentWidth, 23, { align: 'right' });

    // C. Garis Pembatas Kop Resmi (Double Rule Line Tebal-Tipis)
    const lineY = 26.5;
    doc.setDrawColor(15, 23, 42); // Garis Atas Tebal
    doc.setLineWidth(0.8);
    doc.line(margin, lineY, margin + contentWidth, lineY);

    doc.setDrawColor(100, 116, 139); // Garis Bawah Tipis
    doc.setLineWidth(0.25);
    doc.line(margin, lineY + 1.2, margin + contentWidth, lineY + 1.2);

    // ============================================================
    // 2. METADATA & INSTRUMEN DOKUMEN REKAPITULASI
    // ============================================================
    const metaBoxY = 30.5;
    const metaBoxHeight = 18;

    // Background kotak informasi dokumen
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, metaBoxY, contentWidth, metaBoxHeight, 2, 2, 'FD');

    // Judul Dokumen (Tengah)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('REKAPITULASI LAPORAN OPERASIONAL RESMI', margin + contentWidth / 2, metaBoxY + 5, {
      align: 'center',
    });

    doc.setFontSize(8.5);
    doc.setTextColor(5, 150, 105);
    doc.text(options.title.toUpperCase(), margin + contentWidth / 2, metaBoxY + 9, {
      align: 'center',
    });

    // Metadata Kiri
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    const docNumber =
      options.nomorDokumen ||
      `REKAP/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${Math.floor(1000 + Math.random() * 9000)}`;
    const divisiName = options.divisi || 'Semua Divisi Operasional';
    const cabangName = options.cabang || 'Gudang Pusat';

    doc.text(`No. Berkas    : ${docNumber}`, margin + 4, metaBoxY + 13.5);
    doc.text(`Divisi           : ${divisiName}`, margin + 4, metaBoxY + 16.5);
    doc.text(`Lokasi Cabang: ${cabangName}`, margin + 65, metaBoxY + 16.5);

    // Metadata Kanan
    const filterInfo = options.periodeFilter || 'Semua Waktu / Periode';
    const operatorName = options.operator || 'Super Administrator (Petugas Resmi)';
    const printDate = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB';

    doc.text(`Rentang Waktu Filter : ${filterInfo}`, margin + contentWidth - 4, metaBoxY + 13.5, {
      align: 'right',
    });
    doc.text(`Dicetak Pada / Oleh   : ${printDate} (${operatorName})`, margin + contentWidth - 4, metaBoxY + 16.5, {
      align: 'right',
    });

    // ============================================================
    // 3. TABEL DATA REKAPITULASI (jspdf-autotable)
    // ============================================================
    const tableBody =
      options.rows.length > 0
        ? options.rows
        : [[
            '—',
            'Tidak ada data transaksi pada periode filter yang dipilih.',
            ...Array(Math.max(0, options.columns.length - 2)).fill('—'),
          ]];

    if (options.summaryFooter && options.rows.length > 0) {
      tableBody.push(options.summaryFooter);
    }

    const tableStartY = metaBoxY + metaBoxHeight + 3.5;

    autoTable(doc, {
      startY: tableStartY,
      head: [options.columns],
      body: tableBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [15, 23, 42], // Slate-900
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center',
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252], // Slate-50
      },
      columnStyles: options.columnStyles || {},
      didParseCell: (data: any) => {
        // Highlight footer total row jika ada
        if (
          options.summaryFooter &&
          data.row.index === tableBody.length - 1 &&
          options.rows.length > 0
        ) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.textColor = [15, 23, 42];
        }
      },
    });

    let currentY = (doc as any).lastAutoTable?.finalY || tableStartY + 20;

    // ============================================================
    // 4. KOTAK TANDA TANGAN 3 PIHAK RESMI
    // ============================================================
    const requiredSignHeight = 42;
    if (currentY + requiredSignHeight > pageHeight - 12) {
      doc.addPage('a4', 'landscape');
      currentY = 16;
    } else {
      currentY += 4;
    }

    // Catatan kecil
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      options.catatan ||
        '* Data rekapitulasi ini sah dan dihasilkan secara otomatis oleh Sistem Pergudangan Terpadu HK Hub.',
      margin,
      currentY
    );
    currentY += 4;

    // 3 Kolom Tanda Tangan
    const colWidth = contentWidth / 3;
    const signBoxWidth = colWidth - 8;
    const signBoxHeight = 28;

    const parties = [
      {
        title: 'Dibuat Oleh:',
        sub: 'Operator / Petugas Gudang',
        name: options.operator || 'Staff Gudang',
      },
      {
        title: 'Diperiksa Oleh:',
        sub: 'Supervisor / Koordinator',
        name: 'Supervisor Logistik',
      },
      {
        title: 'Disetujui Oleh:',
        sub: 'Kepala Gudang / Manajer',
        name: 'Manajer Operasional',
      },
    ];

    parties.forEach((p, idx) => {
      const boxX = margin + idx * colWidth + 4;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225); // Slate-300
      doc.setLineWidth(0.2);
      doc.roundedRect(boxX, currentY, signBoxWidth, signBoxHeight, 1.5, 1.5, 'FD');

      // Title & Sub
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text(p.title, boxX + signBoxWidth / 2, currentY + 4, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(p.sub, boxX + signBoxWidth / 2, currentY + 7.5, { align: 'center' });

      // Stempel / Digital verification placeholder
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.8);
      doc.setTextColor(148, 163, 184);
      doc.text('[ VERIFIKASI SISTEM ERP ]', boxX + signBoxWidth / 2, currentY + 16, {
        align: 'center',
      });

      // Line
      doc.setDrawColor(148, 163, 184);
      doc.line(boxX + 6, currentY + 22, boxX + signBoxWidth - 6, currentY + 22);

      // Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text(`( ${p.name} )`, boxX + signBoxWidth / 2, currentY + 25.5, { align: 'center' });
    });

    // ============================================================
    // 5. FOOTER NOMOR HALAMAN PADA SEMUA HALAMAN
    // ============================================================
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);

      // Garis footer tipis
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 8, margin + contentWidth, pageHeight - 8);

      doc.text(
        'Gudang Manufaktur & F&B Hub • Sistem Manajemen Inventory, Kasir POS & Distribusi Multi-Cabang',
        margin,
        pageHeight - 5
      );
      doc.text(`Halaman ${i} dari ${totalPages}`, margin + contentWidth, pageHeight - 5, {
        align: 'right',
      });
    }

    const outputFilename = options.filename
      ? options.filename.endsWith('.pdf')
        ? options.filename
        : `${options.filename}.pdf`
      : `Laporan_${options.title.replace(/[^a-zA-Z0-9]/g, '_')}_A4_Landscape.pdf`;

    doc.save(outputFilename);
    return true;
  } catch (err) {
    console.error('Gagal mengekspor PDF A4 Landscape:', err);
    alert('Terjadi kesalahan saat memproses ekspor PDF A4 Landscape. Silakan coba kembali.');
    return false;
  }
}

/**
 * Fallback legacy untuk kompatibilitas jika dipanggil dengan element ID
 */
export async function exportReportToPdfA4Landscape(
  elementOrId: HTMLElement | string,
  filename: string,
  reportTitle?: string
) {
  try {
    const html2canvasMod = await import('html2canvas');
    const jspdfMod = await import('jspdf');

    const html2canvas = html2canvasMod.default || html2canvasMod;
    const jsPDF = jspdfMod.jsPDF || (jspdfMod as any).default;

    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (!el) {
      alert('Elemen tabel laporan tidak ditemukan untuk diekspor');
      return;
    }

    const canvas = await html2canvas(el, {
      scale: 1.8,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = 297;
    const pdfHeight = 210;
    const margin = 8;

    const availWidth = pdfWidth - margin * 2;
    const availHeight = pdfHeight - margin * 2;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const renderWidth = availWidth;
    const renderHeight = (imgHeight * renderWidth) / imgWidth;

    if (renderHeight <= availHeight) {
      pdf.addImage(imgData, 'JPEG', margin, margin, renderWidth, renderHeight);
    } else {
      let heightLeft = renderHeight;
      let position = margin;

      pdf.addImage(imgData, 'JPEG', margin, position, renderWidth, renderHeight);
      heightLeft -= availHeight;

      while (heightLeft > 0) {
        position = heightLeft - renderHeight + margin;
        pdf.addPage('a4', 'landscape');
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

/**
 * Ekspor Formulir Transaksi ke PDF Kertas A5 (148 x 210 mm)
 */
export async function exportToPdfA5(elementOrId: HTMLElement | string, filename: string) {
  try {
    const html2canvasMod = await import('html2canvas');
    const jspdfMod = await import('jspdf');

    const html2canvas = html2canvasMod.default || html2canvasMod;
    const jsPDF = jspdfMod.jsPDF || (jspdfMod as any).default;

    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (!el) {
      alert('Elemen formulir tidak ditemukan untuk diekspor ke PDF');
      return;
    }

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5',
      compress: true,
    });

    const pdfWidth = 148;
    const pdfHeight = 210;
    const margin = 6;

    const availWidth = pdfWidth - margin * 2;
    const availHeight = pdfHeight - margin * 2;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const widthRatio = availWidth / imgWidth;
    const heightRatio = availHeight / imgHeight;
    const scale = Math.min(widthRatio, heightRatio);

    const renderWidth = imgWidth * scale;
    const renderHeight = imgHeight * scale;

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
    const html2canvasMod = await import('html2canvas');
    const html2canvas = html2canvasMod.default || html2canvasMod;

    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (!el) {
      alert('Elemen formulir tidak ditemukan untuk diekspor ke PNG');
      return;
    }

    const canvas = await html2canvas(el, {
      scale: 2.5,
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
