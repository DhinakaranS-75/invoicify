// ===================== Currency & formatting =====================

export const CURRENCY_SYMBOLS = {
  INR: '\u20B9', USD: '$', EUR: '\u20AC', GBP: '\u00A3',
  AED: '\u062F.\u0625', AUD: '$', SGD: '$'
};

export const COUNTRY_PHONE_CODES = {
  'India': '+91', 'United States': '+1', 'United Kingdom': '+44',
  'United Arab Emirates': '+971', 'Australia': '+61', 'Canada': '+1',
  'Singapore': '+65', 'Germany': '+49'
};

/** Format a number as currency using the given currency code (default INR). */
export function fmt(amount, currency = 'INR') {
  const symbol = CURRENCY_SYMBOLS[currency] || '\u20B9';
  const n = Number(amount) || 0;
  return symbol + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function currencySymbol(currency = 'INR') {
  return CURRENCY_SYMBOLS[currency] || '\u20B9';
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

let idCounters = {};
export function generateId(prefix) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${s}`;
}

// ===================== Number to words (Indian system) =====================

export function numberToWords(num) {
  if (num == null || isNaN(num)) return '';
  num = Math.round(num * 100) / 100;
  const whole = Math.floor(num);
  const paise = Math.round((num - whole) * 100);
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function twoDigits(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  }
  function threeDigits(n) {
    let str = '';
    if (n >= 100) { str += ones[Math.floor(n / 100)] + ' Hundred'; n %= 100; if (n) str += ' '; }
    if (n) str += twoDigits(n);
    return str;
  }
  if (whole === 0 && paise === 0) return 'Zero';
  let words = '';
  const crore = Math.floor(whole / 10000000);
  const lakh = Math.floor((whole % 10000000) / 100000);
  const thousand = Math.floor((whole % 100000) / 1000);
  const hundred = whole % 1000;
  if (crore) { words += threeDigits(crore) + ' Crore '; }
  if (lakh) { words += threeDigits(lakh) + ' Lakh '; }
  if (thousand) { words += threeDigits(thousand) + ' Thousand '; }
  if (hundred) { words += threeDigits(hundred); }
  words = words.trim();
  if (paise > 0) { words += ' and ' + twoDigits(paise) + ' Paise'; }
  return words + ' Only';
}

// ===================== Roles & permissions =====================

export const ROLE_PERMISSIONS = {
  admin:   { createInvoice: true,  editInvoice: true,  deleteInvoice: true,  recordPayment: true,  manageItems: true,  manageCustomers: true,  viewReports: true,  manageSettings: true,  manageTeam: true },
  staff:   { createInvoice: true,  editInvoice: true,  deleteInvoice: false, recordPayment: true,  manageItems: true,  manageCustomers: true,  viewReports: true,  manageSettings: false, manageTeam: false },
  worker:  { createInvoice: false, editInvoice: false, deleteInvoice: false, recordPayment: false, manageItems: false, manageCustomers: false, viewReports: false, manageSettings: false, manageTeam: false },
  auditor: { createInvoice: false, editInvoice: false, deleteInvoice: false, recordPayment: false, manageItems: false, manageCustomers: false, viewReports: true,  manageSettings: false, manageTeam: false }
};

export const ROLE_LABELS = { admin: 'Admin', staff: 'Staff', worker: 'Worker', auditor: 'Auditor' };

export function statusBadgeClass(status) {
  return 'status-' + (status || 'Unpaid').toLowerCase();
}

export function paymentMethodIcon(method) {
  if (method === 'Cash') return 'fa-money-bill-wave';
  if (method === 'UPI') return 'fa-mobile-screen-button';
  if (method === 'Bank Account') return 'fa-building-columns';
  return 'fa-wallet';
}
