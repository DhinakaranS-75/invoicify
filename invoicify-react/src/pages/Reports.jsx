import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { fmt, statusBadgeClass } from '../utils/format';
import { getReportBounds, inRange } from '../utils/dates';
import { api } from '../utils/api';
import { exportGstSummaryToCsv } from '../utils/csvExport';
import ChartCanvas from '../components/ChartCanvas';

const PERIOD_LABELS = {
  this_month: 'This Month', last_month: 'Last Month', this_quarter: 'This Quarter',
  fy_current: 'This Fiscal Year', all: 'All Time'
};

const STATUS_COLORS = {
  Paid: '#17b3a3', Sent: '#8b5e3c', Unpaid: '#f2703c', Overdue: '#e0335c', Draft: '#9598b8'
};

export default function Reports() {
  const { invoices, incomes, expenses, currency, currentUser } = useData();
  const { theme } = useTheme();
  const { toast } = useToast();
  const [period, setPeriod] = useState('fy_current');
  const [sendingReport, setSendingReport] = useState(false);
  const company = currentUser?.company || {};

  const [start, end] = getReportBounds(period);
  const textColor = theme === 'dark' ? '#c8c9e8' : '#5b5d7a';

  const sendReport = async () => {
    setSendingReport(true);
    try {
      const res = await api.post('/api/reports/email', {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
        label: PERIOD_LABELS[period] || period
      });
      toast('Report sent', res.message || 'Check your company inbox.');
    } catch (err) {
      toast('Could not send report', err.message || 'Please try again.', 'error');
    } finally {
      setSendingReport(false);
    }
  };

  const exportGstCsv = () => {
    exportGstSummaryToCsv(
      { hsnSummary: data.hsnSummary, b2bInvoices: data.b2bInvoices, b2cSummary: data.b2cSummary },
      PERIOD_LABELS[period] || period,
      `gst-summary-${new Date().toISOString().slice(0, 10)}`
    );
    toast('CSV downloaded', 'GST summary exported.');
  };

  const data = useMemo(() => {
    // Cancelled invoices are kept for record-keeping but never count toward
    // revenue, tax, or GST figures — excluding them here means every
    // calculation below (revenue, GST summary, top customers/items) is
    // automatically correct without needing to filter each one separately.
    const invInRange = invoices.filter((inv) => inv.status !== 'Cancelled' && inRange(inv.date, start, end));
    const totalRevenue = invInRange.reduce((s, i) => s + (i.total || 0), 0);
    let collected = 0;
    invInRange.forEach((inv) => { (inv.payments || []).forEach((p) => { collected += p.amount; }); });
    const outstanding = Math.max(0, totalRevenue - collected);

    // Status breakdown
    const statusCounts = {};
    invInRange.forEach((inv) => {
      const s = inv.status || 'Unpaid';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    // Income vs expense
    const incInRange = incomes.filter((e) => inRange(e.date, start, end)).reduce((s, e) => s + e.amount, 0);
    const totalIncome = incInRange + collected;
    const totalExpense = expenses.filter((e) => inRange(e.date, start, end)).reduce((s, e) => s + e.amount, 0);
    const netProfit = totalIncome - totalExpense;

    // Tax
    let taxable = 0, tax = 0;
    invInRange.forEach((inv) => {
      const s = inv.snapshot || {};
      const sub = (s.items || []).reduce((sum, li) => sum + (li.qty || 0) * (li.rate || 0), 0);
      taxable += sub;
      tax += sub * (parseFloat(s.taxPct) || 0) / 100;
    });

    // Top customers
    const custMap = {};
    invInRange.forEach((inv) => { custMap[inv.client] = (custMap[inv.client] || 0) + (inv.total || 0); });
    const topCustomers = Object.entries(custMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Top items
    const itemMap = {};
    invInRange.forEach((inv) => {
      (inv.snapshot?.items || []).forEach((li) => {
        if (!li.name) return;
        itemMap[li.name] = (itemMap[li.name] || 0) + (li.qty || 0) * (li.rate || 0);
      });
    });
    const topItems = Object.entries(itemMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // ---- GST Summary (GSTR-1-ready) ----
    // Table 12 style: grouped by HSN + tax rate (a line item's rate comes
    // from its invoice's single taxPct — there's no per-line-item rate).
    const hsnMap = {};
    invInRange.forEach((inv) => {
      const s = inv.snapshot || {};
      const rate = parseFloat(s.taxPct) || 0;
      (s.items || []).forEach((li) => {
        const hsn = li.hsn || 'N/A';
        const key = hsn + '|' + rate;
        if (!hsnMap[key]) hsnMap[key] = { hsn, rate, qty: 0, taxable: 0, desc: li.name || '' };
        hsnMap[key].qty += li.qty || 0;
        hsnMap[key].taxable += (li.qty || 0) * (li.rate || 0);
      });
    });
    const hsnSummary = Object.values(hsnMap)
      .map((row) => ({ ...row, taxAmt: row.taxable * row.rate / 100, total: row.taxable * (1 + row.rate / 100) }))
      .sort((a, b) => b.taxable - a.taxable);

    // Table 4 style: invoice-wise, only for customers with a GSTIN (B2B).
    const companyState = (company.state || '').trim().toLowerCase();
    const b2bInvoices = invInRange.filter((inv) => inv.snapshot?.toGst).map((inv) => {
      const s = inv.snapshot || {};
      const rate = parseFloat(s.taxPct) || 0;
      const taxable = (s.items || []).reduce((sum, li) => sum + (li.qty || 0) * (li.rate || 0), 0);
      const taxAmt = taxable * rate / 100;
      const placeOfSupply = s.toState || '';
      const stateKnown = !!placeOfSupply;
      const interState = stateKnown && placeOfSupply.trim().toLowerCase() !== companyState;
      return {
        gst: s.toGst, number: inv.number, date: inv.date, client: inv.client,
        placeOfSupply: placeOfSupply || 'Unknown', stateKnown, taxable, rate, taxAmt,
        igst: interState ? taxAmt : 0,
        cgst: stateKnown && !interState ? taxAmt / 2 : 0,
        sgst: stateKnown && !interState ? taxAmt / 2 : 0,
        total: taxable + taxAmt
      };
    });
    const b2bMissingState = b2bInvoices.filter((r) => !r.stateKnown).length;

    // Table 7 style: remaining invoices (no GSTIN), aggregated by rate.
    const b2cInvoices = invInRange.filter((inv) => !inv.snapshot?.toGst);
    const b2cMap = {};
    b2cInvoices.forEach((inv) => {
      const s = inv.snapshot || {};
      const rate = parseFloat(s.taxPct) || 0;
      const taxable = (s.items || []).reduce((sum, li) => sum + (li.qty || 0) * (li.rate || 0), 0);
      if (!b2cMap[rate]) b2cMap[rate] = { rate, count: 0, taxable: 0 };
      b2cMap[rate].count += 1;
      b2cMap[rate].taxable += taxable;
    });
    const b2cSummary = Object.values(b2cMap)
      .map((row) => ({ ...row, taxAmt: row.taxable * row.rate / 100, total: row.taxable * (1 + row.rate / 100) }))
      .sort((a, b) => b.taxable - a.taxable);

    return {
      invInRange, totalRevenue, collected, outstanding, statusCounts, totalIncome, totalExpense,
      netProfit, taxable, tax, topCustomers, topItems,
      hsnSummary, b2bInvoices, b2bMissingState, b2cSummary
    };
  }, [invoices, incomes, expenses, start, end, company.state]);

  const statusEntries = Object.entries(data.statusCounts);
  const statusChartConfig = {
    type: 'doughnut',
    data: {
      labels: statusEntries.map(([s]) => s),
      datasets: [{
        data: statusEntries.map(([, c]) => c),
        backgroundColor: statusEntries.map(([s]) => STATUS_COLORS[s] || '#9598b8'),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: { legend: { display: false } }
    }
  };

  return (
    <div className="page active">
      <div className="app-header-row">
        <div><h1 className="hide-mobile">Reports</h1><p className="hide-mobile">A clear snapshot of your business performance.</p></div>
        <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select className="report-period-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="fy_current">This Fiscal Year</option>
            <option value="all">All Time</option>
          </select>
          <button className="btn btn-small btn-orange" onClick={sendReport} disabled={sendingReport}>
            <i className="fa-solid fa-envelope"></i> {sendingReport ? 'Sending…' : 'Email Report'}
          </button>
        </div>
      </div>

      {/* Segment 1: Business Summary */}
      <div className="report-segment">
        <div className="report-seg-head"><i className="fa-solid fa-chart-simple"></i> Business Summary</div>
        <div className="stat-grid report-stat-grid-4">
          <div className="stat-card"><div className="stat-label">Total Invoices</div><div className="stat-value">{data.invInRange.length}</div></div>
          <div className="stat-card"><div className="stat-label">Total Revenue</div><div className="stat-value">{fmt(data.totalRevenue, currency)}</div></div>
          <div className="stat-card"><div className="stat-label">Amount Collected</div><div className="stat-value" style={{ color: 'var(--teal)' }}>{fmt(data.collected, currency)}</div></div>
          <div className="stat-card"><div className="stat-label">Outstanding</div><div className="stat-value" style={{ color: 'var(--orange)' }}>{fmt(data.outstanding, currency)}</div></div>
        </div>
      </div>

      {/* Segment 2: Invoice Status */}
      <div className="report-segment">
        <div className="report-seg-head"><i className="fa-solid fa-file-invoice"></i> Invoice Status Breakdown</div>
        <div className="report-two-col">
          <div className="panel">
            {statusEntries.length === 0
              ? <p className="empty-line" style={{ fontSize: '13px' }}>No invoices in this period.</p>
              : <ChartCanvas config={statusChartConfig} height={240} />}
          </div>
          <div className="panel">
            <div className="status-legend">
              {statusEntries.length === 0
                ? <p className="empty-line" style={{ fontSize: '13px' }}>Nothing to show yet.</p>
                : statusEntries.map(([s, c]) => (
                  <div className="status-legend-row" key={s}>
                    <div className="status-legend-left"><span className="status-legend-dot" style={{ background: STATUS_COLORS[s] || '#9598b8' }}></span>{s}</div>
                    <span className="status-legend-count">{c}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Segment 3: Income vs Expense */}
      <div className="report-segment">
        <div className="report-seg-head"><i className="fa-solid fa-money-bill-trend-up"></i> Income vs Expense</div>
        <div className="stat-grid report-stat-grid-3">
          <div className="stat-card"><div className="stat-label">Total Income</div><div className="stat-value" style={{ color: 'var(--teal)' }}>{fmt(data.totalIncome, currency)}</div></div>
          <div className="stat-card"><div className="stat-label">Total Expense</div><div className="stat-value" style={{ color: 'var(--danger)' }}>{fmt(data.totalExpense, currency)}</div></div>
          <div className="stat-card"><div className="stat-label">Net Profit</div><div className="stat-value" style={{ color: data.netProfit >= 0 ? 'var(--teal)' : 'var(--danger)' }}>{fmt(data.netProfit, currency)}</div></div>
        </div>
      </div>

      {/* Segment 4: Tax */}
      <div className="report-segment">
        <div className="report-seg-head"><i className="fa-solid fa-receipt"></i> Tax Summary</div>
        <div className="stat-grid report-stat-grid-2" style={{ maxWidth: '520px' }}>
          <div className="stat-card"><div className="stat-label">Taxable Amount</div><div className="stat-value">{fmt(data.taxable, currency)}</div></div>
          <div className="stat-card"><div className="stat-label">Tax Collected</div><div className="stat-value">{fmt(data.tax, currency)}</div></div>
        </div>
      </div>

      {/* Segment 4b: GST Summary (GSTR-1 ready) — only for GST-registered businesses */}
      {company.gst && (
        <div className="report-segment">
          <div className="report-seg-head"><i className="fa-solid fa-file-contract"></i> GST Summary (GSTR-1 ready)</div>

          <div className="panel" style={{ marginBottom: '16px' }}>
            <div className="panel-head-row panel-head-row-actions">
              <h3>HSN/SAC-wise Summary <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '12px' }}>(Table 12 style)</span></h3>
              <button className="btn btn-small btn-outline" onClick={exportGstCsv} title="Export as CSV"><i className="fa-solid fa-file-csv"></i> Export GST Summary CSV</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="invoice-dash-table">
                <thead><tr><th>HSN/SAC</th><th>Description</th><th>Qty</th><th>Rate</th><th>Taxable Value</th><th>Tax Amount</th><th>Total</th></tr></thead>
                <tbody>
                  {data.hsnSummary.length === 0 ? (
                    <tr><td colSpan="7"><p className="empty-line" style={{ fontSize: '13px', margin: 0 }}>No items in this period.</p></td></tr>
                  ) : data.hsnSummary.map((row) => (
                    <tr key={row.hsn + row.rate} className="inv-row">
                      <td>{row.hsn}</td>
                      <td>{row.desc || '—'}</td>
                      <td>{row.qty}</td>
                      <td>{row.rate}%</td>
                      <td className="amt-col">{fmt(row.taxable, currency)}</td>
                      <td className="amt-col">{fmt(row.taxAmt, currency)}</td>
                      <td className="amt-col">{fmt(row.total, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: '16px' }}>
            <h3>B2B Invoices <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '12px' }}>(Table 4 style — customers with GSTIN)</span></h3>
            {data.b2bMissingState > 0 && (
              <p style={{ fontSize: '12px', color: 'var(--orange)', margin: '0 0 10px' }}>
                <i className="fa-solid fa-triangle-exclamation"></i> {data.b2bMissingState} invoice{data.b2bMissingState > 1 ? 's' : ''} above {data.b2bMissingState > 1 ? 'don\'t' : 'doesn\'t'} have a saved Place of Supply — edit and re-save to fix (older invoices, created before this field existed).
              </p>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table className="invoice-dash-table">
                <thead><tr><th>GSTIN</th><th>Invoice #</th><th>Date</th><th>Customer</th><th>Place of Supply</th><th>Taxable Value</th><th>IGST</th><th>CGST</th><th>SGST</th><th>Total</th></tr></thead>
                <tbody>
                  {data.b2bInvoices.length === 0 ? (
                    <tr><td colSpan="10"><p className="empty-line" style={{ fontSize: '13px', margin: 0 }}>No B2B invoices (with GSTIN) in this period.</p></td></tr>
                  ) : data.b2bInvoices.map((row) => (
                    <tr key={row.number} className="inv-row">
                      <td>{row.gst}</td>
                      <td>{row.number}</td>
                      <td>{row.date || '—'}</td>
                      <td>{row.client}</td>
                      <td>{row.stateKnown ? row.placeOfSupply : <span style={{ color: 'var(--orange)' }}>Unknown</span>}</td>
                      <td className="amt-col">{fmt(row.taxable, currency)}</td>
                      <td className="amt-col">{row.igst > 0 ? fmt(row.igst, currency) : '—'}</td>
                      <td className="amt-col">{row.cgst > 0 ? fmt(row.cgst, currency) : '—'}</td>
                      <td className="amt-col">{row.sgst > 0 ? fmt(row.sgst, currency) : '—'}</td>
                      <td className="amt-col">{fmt(row.total, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h3>B2C Summary <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '12px' }}>(Table 7 style — no GSTIN, grouped by rate)</span></h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="invoice-dash-table">
                <thead><tr><th>Tax Rate</th><th>Invoices</th><th>Taxable Value</th><th>Tax Amount</th><th>Total</th></tr></thead>
                <tbody>
                  {data.b2cSummary.length === 0 ? (
                    <tr><td colSpan="5"><p className="empty-line" style={{ fontSize: '13px', margin: 0 }}>No B2C invoices in this period.</p></td></tr>
                  ) : data.b2cSummary.map((row) => (
                    <tr key={row.rate} className="inv-row">
                      <td>{row.rate}%</td>
                      <td>{row.count}</td>
                      <td className="amt-col">{fmt(row.taxable, currency)}</td>
                      <td className="amt-col">{fmt(row.taxAmt, currency)}</td>
                      <td className="amt-col">{fmt(row.total, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Segment 5: Top customers & items */}
      <div className="report-segment">
        <div className="report-two-col">
          <div className="panel">
            <h3><i className="fa-solid fa-users"></i> Top Customers</h3>
            <div className="report-rank-list">
              {data.topCustomers.length === 0
                ? <p className="empty-line" style={{ fontSize: '13px' }}>No data yet.</p>
                : data.topCustomers.map(([name, amt], i) => (
                  <div className="report-rank-item" key={name}>
                    <span className="report-rank-num">{i + 1}</span>
                    <span className="report-rank-name">{name}</span>
                    <span className="report-rank-val">{fmt(amt, currency)}</span>
                  </div>
                ))}
            </div>
          </div>
          <div className="panel">
            <h3><i className="fa-solid fa-box"></i> Top Items</h3>
            <div className="report-rank-list">
              {data.topItems.length === 0
                ? <p className="empty-line" style={{ fontSize: '13px' }}>No data yet.</p>
                : data.topItems.map(([name, amt], i) => (
                  <div className="report-rank-item" key={name}>
                    <span className="report-rank-num">{i + 1}</span>
                    <span className="report-rank-name">{name}</span>
                    <span className="report-rank-val">{fmt(amt, currency)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Segment 6: Invoices in period */}
      <div className="report-segment">
        <div className="report-seg-head"><i className="fa-solid fa-list"></i> Invoices in this period</div>
        <div className="panel">
          <div style={{ overflowX: 'auto' }}>
            <table className="invoice-dash-table">
              <thead><tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>Status</th><th>Amount</th></tr></thead>
              <tbody>
                {data.invInRange.length === 0 ? (
                  <tr><td colSpan="5"><p className="empty-line" style={{ fontSize: '13px', margin: 0 }}>No invoices in this period.</p></td></tr>
                ) : data.invInRange.slice().reverse().map((inv) => (
                  <tr key={inv.id} className="inv-row">
                    <td>{inv.number}</td>
                    <td>{inv.date || '—'}</td>
                    <td>{inv.client}</td>
                    <td><span className={'status-badge ' + statusBadgeClass(inv.status || 'Unpaid')}>{inv.status || 'Unpaid'}</span></td>
                    <td className="amt-col">{fmt(inv.total, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
