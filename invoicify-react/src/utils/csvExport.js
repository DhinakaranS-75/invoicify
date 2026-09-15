// Client-side CSV export for the Invoices list. No backend round-trip needed —
// the data is already in memory via DataContext. Opens fine in Excel/Google
// Sheets/Zoho Sheet, which is what "GST filing ku accountant ku kudukka"
// actually needs (a real .xlsx binary isn't required for that).

function csvEscape(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Builds one CSV row per invoice (not per line-item) — invoice number, date,
 * customer, GSTIN, status, taxable amount, tax, total, paid, balance. This
 * matches the level of detail an accountant needs for GST return filing
 * without requiring a line-item-level export.
 */
export function buildInvoicesCsv(invoices, customers) {
  const gstByName = {};
  (customers || []).forEach((c) => { if (c.name) gstByName[c.name] = c.gst || ''; });

  const lines = [];
  lines.push([
    'Invoice Number', 'Order Number', 'Date', 'Due Date', 'Customer', 'Customer GSTIN',
    'Status', 'Taxable Amount', 'Tax %', 'Tax Amount', 'Discount %', 'Total', 'Paid', 'Balance'
  ].join(','));

  invoices.forEach((inv) => {
    const s = inv.snapshot || {};
    const items = s.items || [];
    const taxable = items.reduce((sum, li) => sum + (li.qty || 0) * (li.rate || 0), 0);
    const taxPct = parseFloat(s.taxPct) || 0;
    const discPct = parseFloat(s.discountPct) || 0;
    const taxAmt = taxable * taxPct / 100;
    const paid = (inv.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const total = inv.total || 0;

    lines.push([
      csvEscape(inv.number), csvEscape(inv.orderNumber), csvEscape(inv.date), csvEscape(inv.dueDate),
      csvEscape(inv.client), csvEscape(gstByName[inv.client] || ''), csvEscape(inv.status || 'Unpaid'),
      taxable.toFixed(2), taxPct, taxAmt.toFixed(2), discPct, total.toFixed(2),
      paid.toFixed(2), Math.max(0, total - paid).toFixed(2)
    ].join(','));
  });

  return lines.join('\n');
}

/** Triggers a browser download of the given CSV text. */
export function downloadCsv(csvContent, filename) {
  // UTF-8 BOM prefix — without this, Excel on Windows (the default for most
  // Indian small-business users) misreads the file's encoding and renders
  // any special characters (em dashes, ₹ symbols) as garbled text.
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Builds a single CSV with three sections — HSN-wise summary, B2B invoices,
 * and B2C summary — matching the tables shown on the Reports page GST
 * Summary segment. One file an accountant can open directly to fill GSTR-1.
 */
export function buildGstSummaryCsv({ hsnSummary, b2bInvoices, b2cSummary, periodLabel }) {
  const lines = [];
  lines.push(`GST Summary (${csvEscape(periodLabel || '')})`);
  lines.push('');

  lines.push('HSN/SAC-wise Summary (GSTR-1 Table 12 style)');
  lines.push(['HSN/SAC', 'Description', 'Qty', 'Tax Rate %', 'Taxable Value', 'Tax Amount', 'Total'].join(','));
  hsnSummary.forEach((row) => {
    lines.push([csvEscape(row.hsn), csvEscape(row.desc), row.qty, row.rate, row.taxable.toFixed(2), row.taxAmt.toFixed(2), row.total.toFixed(2)].join(','));
  });
  lines.push('');

  lines.push('B2B Invoices (GSTR-1 Table 4 style - customers with GSTIN)');
  lines.push(['GSTIN', 'Invoice #', 'Date', 'Customer', 'Place of Supply', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Total'].join(','));
  b2bInvoices.forEach((row) => {
    lines.push([
      csvEscape(row.gst), csvEscape(row.number), csvEscape(row.date), csvEscape(row.client),
      csvEscape(row.stateKnown ? row.placeOfSupply : 'Unknown'), row.taxable.toFixed(2),
      row.igst.toFixed(2), row.cgst.toFixed(2), row.sgst.toFixed(2), row.total.toFixed(2)
    ].join(','));
  });
  lines.push('');

  lines.push('B2C Summary (GSTR-1 Table 7 style - no GSTIN - grouped by rate)');
  lines.push(['Tax Rate %', 'Invoices', 'Taxable Value', 'Tax Amount', 'Total'].join(','));
  b2cSummary.forEach((row) => {
    lines.push([row.rate, row.count, row.taxable.toFixed(2), row.taxAmt.toFixed(2), row.total.toFixed(2)].join(','));
  });

  return lines.join('\n');
}

export function exportGstSummaryToCsv(gstData, periodLabel, filename = 'gst-summary') {
  const csv = buildGstSummaryCsv({ ...gstData, periodLabel });
  downloadCsv(csv, filename);
}

/** Convenience: build + download in one call. */
export function exportInvoicesToCsv(invoices, customers, filename = 'invoices') {
  const csv = buildInvoicesCsv(invoices, customers);
  downloadCsv(csv, filename);
}
