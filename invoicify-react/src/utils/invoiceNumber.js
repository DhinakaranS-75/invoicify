// Builds an invoice number string from a config object.
// config = { prefix, middle, separator, padding, next }
export function buildInvoiceNumber(config) {
  const c = config || {};
  const padding = c.padding || 0;
  const next = c.next || 1;
  const numStr = padding > 0 ? String(next).padStart(padding, '0') : String(next);
  const parts = [c.prefix, c.middle, numStr].filter((p) => p !== '' && p != null);
  return parts.join(c.separator ?? '-');
}

export const DEFAULT_INVOICE_NUMBER_CONFIG = {
  prefix: 'INV', middle: '', separator: '-', padding: 3, next: 1
};
