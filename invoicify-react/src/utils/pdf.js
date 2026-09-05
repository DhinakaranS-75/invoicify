import html2pdf from 'html2pdf.js';

/**
 * Exports a DOM element (the invoice document) to a single-page A4 PDF.
 * `element` is the .inv-doc node; `filename` is without extension.
 */
export function exportElementToPDF(element, filename) {
  if (!element) return;
  const opt = {
    margin: 6,
    filename: `${filename}.pdf`,
    // JPEG compresses the gradient/shadow-heavy invoice templates far
    // better than lossless PNG, and scale 2 (vs 3) still prints crisp
    // while cutting pixel count by ~55% — together these take a ~19MB
    // PDF down to a few hundred KB.
    image: { type: 'jpeg', quality: 0.92 },
    html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  return html2pdf().set(opt).from(element).save();
}

/**
 * Renders a DOM element (the invoice document) to a PDF and returns it as a
 * plain base64 string (no data-URL prefix) — ready to POST to a backend
 * endpoint that expects raw base64, e.g. for emailing as an attachment.
 */
export async function getElementPdfBase64(element) {
  if (!element) return null;
  const opt = {
    margin: 6,
    image: { type: 'jpeg', quality: 0.92 },
    html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  // jsPDF's own output('datauristring') gives us base64 directly without an
  // extra Blob->FileReader round trip.
  const dataUri = await html2pdf().set(opt).from(element).outputPdf('datauristring');
  return dataUri.split(',')[1] || dataUri.split('base64,')[1];
}

/**
 * Shares a DOM element (the invoice document) as a PDF via the device's
 * native share sheet — WhatsApp, Gmail/Email, Drive, Bluetooth, whatever the
 * person has installed — with the actual PDF file attached. Falls back to a
 * plain download on browsers that don't support file sharing (mainly
 * desktop), since there's no share sheet to hand the file to there.
 *
 * Returns { shared, method } so the caller can toast something appropriate:
 *   method: 'native'    — the OS share sheet opened successfully
 *   method: 'cancelled' — the person opened the share sheet and backed out
 *   method: 'download'  — no file-sharing support; a normal download ran instead
 */
export async function shareElementAsPDF(element, filename, shareText) {
  if (!element) return { shared: false, method: 'download' };

  const opt = {
    margin: 6,
    filename: `${filename}.pdf`,
    image: { type: 'jpeg', quality: 0.92 },
    html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  // Render once as a blob — shared straight to the OS if possible, or
  // downloaded from that same blob if not, so we never render it twice.
  const blob = await html2pdf().set(opt).from(element).outputPdf('blob');
  const file = new File([blob], `${filename}.pdf`, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
        text: shareText || `Invoice ${filename}`
      });
      return { shared: true, method: 'native' };
    } catch (err) {
      if (err.name === 'AbortError') return { shared: false, method: 'cancelled' };
      throw err;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { shared: false, method: 'download' };
}