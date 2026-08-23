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
