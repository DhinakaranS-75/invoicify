import { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { fmt, generateId } from '../utils/format';
import { getPeriodBounds, monthBuckets, inRange } from '../utils/dates';
import ChartCanvas from '../components/ChartCanvas';
import GettingStarted from '../components/GettingStarted';

export default function Home() {
  const {
    currentUser, invoices, customers, catalogItems,
    incomes, expenses, addIncome, deleteIncome, currency, dataLoading
  } = useData();
  const { theme } = useTheme();
  const { toast } = useToast();

  const [cashflowPeriod, setCashflowPeriod] = useState('fy_current');
  const [methodPeriod, setMethodPeriod] = useState('fy_current');
  const [incomeOpen, setIncomeOpen] = useState(false);

  const firstName = (currentUser?.firstName || currentUser?.name || 'there').split(' ')[0];

  // ---- Getting Started (first-run checklist shown instead of the dashboard) ----
  const onboardKey = 'iv_onboard_done_' + (currentUser?.id || 'u');
  const [gsDismissed, setGsDismissed] = useState(() => !!localStorage.getItem(onboardKey));
  const gsCompany = (() => { const c = currentUser?.company || {}; return !!(c.address || c.contact || c.email || c.bankName); })();
  const gsTemplate = !!localStorage.getItem('iv_onboard_tmpl') || invoices.length > 0;
  const gsAllDone = gsCompany && gsTemplate && customers.length > 0 && catalogItems.length > 0 && invoices.length > 0;
  const showGettingStarted = !gsDismissed && !gsAllDone;
  useEffect(() => {
    if (gsAllDone && !gsDismissed) { localStorage.setItem(onboardKey, '1'); setGsDismissed(true); }
  }, [gsAllDone, gsDismissed, onboardKey]);

  // ---- Stats ----
  const totalRevenue = invoices.reduce((s, i) => s + (i.total || 0), 0);

  // ---- Chart theme colors ----
  const textColor = theme === 'dark' ? '#c8c9e8' : '#5b5d7a';
  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  // ---- Cash Flow chart ----
  const [cfStart, cfEnd] = getPeriodBounds(cashflowPeriod);
  const cfBuckets = monthBuckets(cfStart, cfEnd);

  const cashflow = useMemo(() => {
    const incomeByMonth = cfBuckets.map((b) => {
      let sum = 0;
      invoices.forEach((inv) => {
        const d = inv.date ? new Date(inv.date) : null;
        if (d && d.getFullYear() === b.year && d.getMonth() === b.month) sum += inv.total || 0;
      });
      incomes.forEach((inc) => {
        const d = inc.date ? new Date(inc.date) : null;
        if (d && d.getFullYear() === b.year && d.getMonth() === b.month) sum += inc.amount || 0;
      });
      return sum;
    });
    const outgoingByMonth = cfBuckets.map((b) => {
      let sum = 0;
      expenses.forEach((exp) => {
        const d = exp.date ? new Date(exp.date) : null;
        if (d && d.getFullYear() === b.year && d.getMonth() === b.month) sum += exp.amount || 0;
      });
      return sum;
    });
    return { incomeByMonth, outgoingByMonth };
  }, [cfBuckets, invoices, incomes, expenses]);

  const totalIncome = cashflow.incomeByMonth.reduce((a, b) => a + b, 0);
  const totalOutgoing = cashflow.outgoingByMonth.reduce((a, b) => a + b, 0);

  const cashflowConfig = {
    type: 'line',
    data: {
      labels: cfBuckets.map((b) => b.label),
      datasets: [
        { label: 'Income', data: cashflow.incomeByMonth, borderColor: '#17b3a3', backgroundColor: 'rgba(23,179,163,0.12)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#17b3a3' },
        { label: 'Outgoing', data: cashflow.outgoingByMonth, borderColor: '#f2703c', backgroundColor: 'rgba(242,112,60,0.08)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#f2703c' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } }
      }
    }
  };

  // ---- Payment Method chart ----
  const [pmStart, pmEnd] = getPeriodBounds(methodPeriod);
  const methods = ['Cash', 'UPI', 'Bank Account'];
  const pmData = useMemo(() => {
    const incomeByMethod = methods.map((m) => {
      let sum = incomes.filter((i) => i.method === m && inRange(i.date, pmStart, pmEnd)).reduce((s, i) => s + i.amount, 0);
      invoices.forEach((inv) => {
        (inv.payments || []).forEach((p) => {
          if (p.method === m && inRange(p.date, pmStart, pmEnd)) sum += p.amount;
        });
      });
      return sum;
    });
    const expenseByMethod = methods.map((m) =>
      expenses.filter((e) => e.method === m && inRange(e.date, pmStart, pmEnd)).reduce((s, e) => s + e.amount, 0)
    );
    return { incomeByMethod, expenseByMethod };
  }, [invoices, incomes, expenses, pmStart, pmEnd]);

  const methodConfig = {
    type: 'bar',
    data: {
      labels: methods,
      datasets: [
        { label: 'Income', data: pmData.incomeByMethod, backgroundColor: '#17b3a3', borderRadius: 6, maxBarThickness: 46 },
        { label: 'Expense', data: pmData.expenseByMethod, backgroundColor: '#f2703c', borderRadius: 6, maxBarThickness: 46 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: textColor, usePointStyle: true, pointStyle: 'rectRounded' } } },
      scales: {
        x: { ticks: { color: textColor }, grid: { display: false }, categoryPercentage: 0.6, barPercentage: 0.9 },
        y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } }
      }
    }
  };

  const periodOptions = (
    <>
      <option value="fy_current">This Fiscal Year</option>
      <option value="fy_previous">Previous Fiscal Year</option>
      <option value="last12">Last 12 Months</option>
      <option value="last6">Last 6 Months</option>
      <option value="last3">Last 3 Months</option>
    </>
  );

  if (showGettingStarted) {
    return <GettingStarted onSkip={() => { localStorage.setItem(onboardKey, '1'); setGsDismissed(true); }} />;
  }

  return (
    <div className="page active">
      <div className="app-header-row">
        <div>
          <h1>Welcome, {firstName} 👋</h1>
          <p className="hide-mobile">Here's a quick snapshot of your invoicing activity.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">Total Invoices</div><div className="stat-value">{dataLoading ? '…' : invoices.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total Revenue</div><div className="stat-value">{dataLoading ? '…' : fmt(totalRevenue, currency)}</div></div>
        <div className="stat-card"><div className="stat-label">Customers</div><div className="stat-value">{dataLoading ? '…' : customers.length}</div></div>
        <div className="stat-card"><div className="stat-label">Catalog Items</div><div className="stat-value">{dataLoading ? '…' : catalogItems.length}</div></div>
      </div>

      {/* Cash Flow */}
      <div className="panel">
        <div className="cf-header">
          <h3 style={{ margin: 0 }}>Cash Flow</h3>
          <select value={cashflowPeriod} onChange={(e) => setCashflowPeriod(e.target.value)}>{periodOptions}</select>
        </div>
        <div className="cf-summary">
          <div><span className="cf-dot" style={{ background: '#17b3a3' }}></span>Income <strong>{fmt(totalIncome, currency)}</strong></div>
          <div><span className="cf-dot" style={{ background: '#f2703c' }}></span>Outgoing <strong>{fmt(totalOutgoing, currency)}</strong></div>
          <div>Net <strong>{fmt(totalIncome - totalOutgoing, currency)}</strong></div>
        </div>
        {dataLoading
          ? <p className="empty-line" style={{ padding: '60px 0', textAlign: 'center' }}><i className="fa-solid fa-spinner fa-spin"></i> Loading your data…</p>
          : <ChartCanvas config={cashflowConfig} height={260} />}
      </div>

      {/* Payment Method */}
      <div className="panel section-gap">
        <div className="cf-header">
          <h3 style={{ margin: 0 }}>Income &amp; Expense by Payment Method</h3>
          <select value={methodPeriod} onChange={(e) => setMethodPeriod(e.target.value)}>{periodOptions}</select>
        </div>
        {dataLoading
          ? <p className="empty-line" style={{ padding: '50px 0', textAlign: 'center' }}><i className="fa-solid fa-spinner fa-spin"></i> Loading your data…</p>
          : <ChartCanvas config={methodConfig} height={240} />}
      </div>

      {/* Add Income */}
      <IncomePanel open={incomeOpen} setOpen={setIncomeOpen} incomes={incomes} addIncome={addIncome} deleteIncome={deleteIncome} currency={currency} toast={toast} />

      {/* Add Expense now lives on its own page — see the "Expenses" nav item */}

      {/* Recent Invoices */}
      <div className="panel section-gap">
        <h3>Recent Invoices</h3>
        <div className="saved-list">
          {invoices.length === 0
            ? <p className="empty-line" style={{ fontSize: '13px' }}>No invoices yet.</p>
            : invoices.slice().reverse().slice(0, 5).map((inv) => (
              <div className="saved-item" key={inv.id}>
                <div><strong>{inv.number}</strong>{inv.client}</div>
                <div className="amt-col">{fmt(inv.total, currency)}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function IncomePanel({ open, setOpen, incomes, addIncome, deleteIncome, currency, toast }) {
  const [f, setF] = useState({ desc: '', amount: '', date: new Date().toISOString().slice(0, 10), method: 'Cash' });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = () => {
    const amount = parseFloat(f.amount);
    if (!f.desc.trim()) { toast('Description required', 'Enter an income description.', 'error'); return; }
    if (isNaN(amount) || amount <= 0) { toast('Invalid amount', 'Enter a valid amount.', 'error'); return; }
    addIncome({ id: generateId('INC'), desc: f.desc, amount, date: f.date, method: f.method });
    setF({ desc: '', amount: '', date: new Date().toISOString().slice(0, 10), method: 'Cash' });
    toast('Income added', `${fmt(amount, currency)} recorded.`);
  };

  return (
    <div className="panel section-gap">
      <div className="collapsible-header" onClick={() => setOpen((o) => !o)}>
        <h3 style={{ margin: 0 }}>Add Income</h3>
        <i className={'fa-solid fa-chevron-down' + (open ? ' open' : '')}></i>
      </div>
      {open && (
        <div>
          <div className="grid2 section-gap">
            <div className="field-sm"><label>Description</label><input value={f.desc} onChange={set('desc')} placeholder="Consulting Fee" /></div>
            <div className="field-sm"><label>Amount</label><input type="number" min="0" step="0.01" value={f.amount} onChange={set('amount')} placeholder="0.00" /></div>
            <div className="field-sm"><label>Date</label><input type="date" value={f.date} onChange={set('date')} /></div>
            <div className="field-sm"><label>Payment Method</label>
              <select value={f.method} onChange={set('method')}>
                <option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank Account">Bank Account</option>
              </select>
            </div>
          </div>
          <button className="btn btn-small btn-teal" onClick={submit}><i className="fa-solid fa-plus"></i> Add Income</button>
        </div>
      )}
      <div className="section-gap">
        <h3>Recent Income</h3>
        <div className="saved-list">
          {incomes.length === 0
            ? <p className="empty-line" style={{ fontSize: '13px' }}>No income recorded yet.</p>
            : incomes.slice().reverse().slice(0, 5).map((e) => (
              <div className="saved-item" key={e.id}>
                <div><strong>{e.desc}</strong>{e.date} · {e.method}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="amt-col" style={{ color: 'var(--teal)' }}>{fmt(e.amount, currency)}</span>
                  <button className="pay-history-del" onClick={() => deleteIncome(e.id)}><i className="fa-solid fa-trash-can"></i></button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}