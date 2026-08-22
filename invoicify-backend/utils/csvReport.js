// Builds a plain-text CSV report (invoices + expenses + summary totals) for
// a single company over a given month. Used by the month-end auto-email job.

function csvEscape(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function buildMonthlyReportCsv({ monthLabel, companyName, invoices, expenses }) {
  const lines = [];
  lines.push(`Invoicify Monthly Report - ${companyName} - ${monthLabel}`);
  lines.push('');

  lines.push('INVOICES');
  lines.push('Invoice Number,Date,Customer,Status,Total,Paid,Balance');
  let totalRevenue = 0;
  let totalCollected = 0;
  invoices.forEach((inv) => {
    const paid = (inv.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const total = inv.total || 0;
    totalRevenue += total;
    totalCollected += paid;
    lines.push([
      csvEscape(inv.number), csvEscape(inv.date), csvEscape(inv.client),
      csvEscape(inv.status), total, paid, (total - paid).toFixed(2)
    ].join(','));
  });
  if (invoices.length === 0) lines.push('(no invoices this month)');

  lines.push('');
  lines.push('EXPENSES');
  lines.push('Description,Date,Category,Method,Amount');
  let totalExpense = 0;
  expenses.forEach((e) => {
    totalExpense += e.amount || 0;
    lines.push([csvEscape(e.desc), csvEscape(e.date), csvEscape(e.category), csvEscape(e.method), e.amount].join(','));
  });
  if (expenses.length === 0) lines.push('(no expenses this month)');

  lines.push('');
  lines.push('SUMMARY');
  lines.push(`Total Revenue (invoiced),${totalRevenue.toFixed(2)}`);
  lines.push(`Total Collected,${totalCollected.toFixed(2)}`);
  lines.push(`Total Expenses,${totalExpense.toFixed(2)}`);
  lines.push(`Net Profit,${(totalCollected - totalExpense).toFixed(2)}`);

  return lines.join('\n');
}

// True only on the final calendar day of the month for the given date
// (defaults to now). Lets the cron endpoint be hit daily but only actually
// send reports once a month.
export function isLastDayOfMonth(date = new Date()) {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getDate() === 1;
}

// "YYYY-MM-01" through today's date, plus a human label like "August 2026" —
// used both to filter records and to label the email/attachment.
export function currentMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
  const end = date.toISOString().slice(0, 10);
  const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { start, end, monthLabel };
}