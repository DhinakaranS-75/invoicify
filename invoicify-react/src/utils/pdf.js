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
    image: { type: 'png' },
    html2canvas: { scale: 3, backgroundColor: '#ffffff', useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  return html2pdf().set(opt).from(element).save();
}
