import { useState, useMemo, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useClickOutside } from '../hooks/useClickOutside';
import { fmt } from '../utils/format';

const CATEGORIES = ['Rent', 'Salaries', 'Supplies', 'Purchases', 'Utilities', 'Marketing', 'Other'];

export default function Expenses() {
  const { expenses, addExpense, deleteExpense, currency } = useData();
  const { toast } = useToast();

  // view: dashboard | form
  const [view, setView] = useState('dashboard');
  const [selected, setSelected] = useState(new Set());
  const [menuFor, setMenuFor] = useState(null);           // mobile card whose ⋮ menu is open
  const [pendingDelete, setPendingDelete] = useState(null); // expense awaiting delete confirm

  // ---- Search ----------------------------------------------------------
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useClickOutside(useCallback(() => setSearchOpen(false), []), searchOpen);

  const [categoryFilter, setCategoryFilter] = useState('all');

  // ---- Stats ------------------------------------------------------------
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + (e.amount || 0), 0), [expenses]);
  const thisMonthTotal = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    return expenses.filter((e) => (e.date || '').startsWith(ym)).reduce((s, e) => s + (e.amount || 0), 0);
  }, [expenses]);
  const purchasesTotal = useMemo(
    () => expenses.filter((e) => e.category === 'Purchases').reduce((s, e) => s + (e.amount || 0), 0),
    [expenses]
  );

  // First narrow by the search box...
  const queryFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter((e) => {
      const haystack = [e.desc, e.category, e.method, e.date, e.amount != null ? String(e.amount) : '']
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [expenses, query]);

  // ...then count each category within those results, so the pills reflect
  // what the current search actually contains.
  const categoryCounts = useMemo(() => {
    const c = {};
    queryFiltered.forEach((e) => { const cat = e.category || 'Other'; c[cat] = (c[cat] || 0) + 1; });
    return c;
  }, [queryFiltered]);

  // ...finally apply the chosen category pill.
  const visibleExpenses = useMemo(() => {
    if (categoryFilter === 'all') return queryFiltered;
    return queryFiltered.filter((e) => (e.category || 'Other') === categoryFilter);
  }, [queryFiltered, categoryFilter]);

  const clearSearch = () => { setQuery(''); setSearchOpen(false); };

  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleSelectAll = (checked) =>
    setSelected(checked ? new Set(visibleExpenses.map((e) => e.id)) : new Set());

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteExpense(pendingDelete.id);
      toast('Expense deleted', `${pendingDelete.desc || 'Expense'} was removed.`, 'delete');
    } catch (err) {
      toast('Could not delete expense', err.message || 'Please try again.', 'error');
    }
    setPendingDelete(null);
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    try {
      await Promise.all(ids.map((id) => deleteExpense(id)));
      toast('Expenses deleted', `${ids.length} removed.`, 'delete');
    } catch (err) {
      toast('Could not delete some expenses', err.message || 'Please try again.', 'error');
    }
    setSelected(new Set());
  };

  if (view === 'form') {
    return (
      <ExpenseForm
        onBack={() => setView('dashboard')}
        addExpense={addExpense}
        currency={currency}
        toast={toast}
      />
    );
  }

  return (
    <div className="page active">
      <div className="app-header-row">
        <div><h1 className="hide-mobile">Expenses</h1><p className="hide-mobile">Track vendor purchases and operating costs.</p></div>
        <div className="header-actions">
          {selected.size > 0 && (
            <button className="btn btn-small" style={{ background: 'var(--danger)', color: '#fff' }} onClick={bulkDelete}>
              <i className="fa-solid fa-trash-can"></i> Delete ({selected.size})
            </button>
          )}
          <button className="btn btn-small btn-orange hide-mobile" onClick={() => setView('form')}>
            <i className="fa-solid fa-plus"></i> Add Expense
          </button>
        </div>
      </div>

      <div className="stat-grid hide-mobile" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="stat-card"><div className="stat-label">Entries</div><div className="stat-value">{expenses.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total Expenses</div><div className="stat-value">{fmt(totalExpenses, currency)}</div></div>
        <div className="stat-card"><div className="stat-label">This Month</div><div className="stat-value">{fmt(thisMonthTotal, currency)}</div></div>
        <div className="stat-card"><div className="stat-label">Purchases (COGS)</div><div className="stat-value">{fmt(purchasesTotal, currency)}</div></div>
      </div>

      <div className="panel">
        <div className="panel-head-row">
          <h3>
            All Expenses
            {(query || categoryFilter !== 'all') && <span className="inv-search-count">{visibleExpenses.length} of {expenses.length}</span>}
          </h3>
          <div className={'inv-search' + (searchOpen ? ' open' : '')} ref={searchRef}>
            <button
              className="inv-search-toggle"
              onClick={() => setSearchOpen((o) => !o)}
              title="Search expenses"
              aria-label="Search expenses"
            >
              <i className="fa-solid fa-magnifying-glass"></i>
            </button>
            <input
              type="search"
              className="inv-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Description, category or method…"
              aria-label="Search expenses"
            />
            {query && (
              <button className="inv-search-clear" onClick={clearSearch} title="Clear" aria-label="Clear search">
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </div>

        {/* Category filter pills — combine with the search box above */}
        {expenses.length > 0 && (
          <div className="inv-filters">
            <button
              className={'inv-filter' + (categoryFilter === 'all' ? ' active' : '')}
              onClick={() => setCategoryFilter('all')}
            >
              All <span className="inv-filter-count">{queryFiltered.length}</span>
            </button>
            {CATEGORIES.filter((c) => categoryCounts[c]).map((c) => (
              <button
                key={c}
                className={'inv-filter' + (categoryFilter === c ? ' active' : '')}
                onClick={() => setCategoryFilter((cur) => (cur === c ? 'all' : c))}
              >
                {c} <span className="inv-filter-count">{categoryCounts[c]}</span>
              </button>
            ))}
          </div>
        )}

        <div className="hide-mobile" style={{ overflowX: 'auto' }}>
          <table className="invoice-dash-table">
            <thead>
              <tr>
                <th style={{ width: '34px' }}>
                  <input
                    type="checkbox"
                    checked={visibleExpenses.length > 0 && selected.size === visibleExpenses.length}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th>Description</th><th>Category</th><th>Date</th><th>Method</th><th>Amount</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleExpenses.length === 0 ? (
                <tr><td colSpan="7"><p className="empty-line" style={{ fontSize: '13px', margin: 0 }}>
                  {(query || categoryFilter !== 'all') ? 'No expenses match these filters.' : 'No expenses yet — add your first one.'}
                </p></td></tr>
              ) : visibleExpenses.slice().reverse().map((e) => (
                <tr key={e.id}>
                  <td><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} /></td>
                  <td>{e.desc}</td>
                  <td>{e.category || 'Other'}</td>
                  <td>{e.date || '—'}</td>
                  <td>{e.method || '—'}</td>
                  <td className="amt-col" style={{ color: 'var(--danger)' }}>{fmt(e.amount, currency)}</td>
                  <td>
                    <button className="row-action-btn" title="Delete" onClick={() => setPendingDelete(e)}>
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="mobile-invoice-cards show-mobile">
          {visibleExpenses.length === 0 ? (
            <p className="empty-line" style={{ fontSize: '13px' }}>
              {(query || categoryFilter !== 'all') ? 'No expenses match these filters.' : 'No expenses yet — tap + to add one.'}
            </p>
          ) : visibleExpenses.slice().reverse().map((e) => (
            <div className="mobile-inv-card" key={e.id}>
              <div className="mic-left">
                <div className="mic-customer">{e.desc}</div>
                <div className="mic-meta">
                  <span>{e.category || 'Other'}</span><br />
                  <span>{e.date || '—'}</span><br />
                  <span>{e.method || '—'}</span>
                </div>
              </div>
              <div className="mic-right">
                <span className="mic-amount" style={{ color: 'var(--danger)' }}>{fmt(e.amount, currency)}</span>
              </div>

              {/* ⋮ actions — stops the card's own tap handlers */}
              <button
                className="mic-kebab"
                aria-label="Expense actions"
                onClick={(ev) => { ev.stopPropagation(); setMenuFor(menuFor === e.id ? null : e.id); }}
              >
                <i className="fa-solid fa-ellipsis-vertical"></i>
              </button>

              {menuFor === e.id && (
                <div className="mic-menu" onClick={(ev) => ev.stopPropagation()}>
                  <button className="mic-menu-danger" onClick={() => { setMenuFor(null); setPendingDelete(e); }}>
                    <i className="fa-solid fa-trash-can"></i> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
          {menuFor && <div className="mic-menu-backdrop" onClick={() => setMenuFor(null)}></div>}
        </div>
      </div>

      {pendingDelete && (
        <div className="confirm-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setPendingDelete(null); }}>
          <div className="confirm-box">
            <div className="confirm-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
            <h3>Delete this expense?</h3>
            <p>{pendingDelete.desc ? `"${pendingDelete.desc}"` : 'This expense'} will be permanently removed. This can't be undone.</p>
            <div className="confirm-actions">
              <button className="btn btn-small" style={{ background: 'var(--danger)', color: '#fff' }} onClick={confirmDelete}>
                <i className="fa-solid fa-trash-can"></i> Delete
              </button>
              <button className="btn btn-small btn-outline" onClick={() => setPendingDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <button className="fab" onClick={() => setView('form')} title="Add Expense"><i className="fa-solid fa-plus"></i></button>
    </div>
  );
}

function ExpenseForm({ onBack, addExpense, currency, toast }) {
  const [f, setF] = useState({
    desc: '', amount: '', date: new Date().toISOString().slice(0, 10),
    category: 'Rent', method: 'Cash'
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    const amount = parseFloat(f.amount);
    if (!f.desc.trim()) { toast('Description required', 'Enter an expense description.', 'error'); return; }
    if (isNaN(amount) || amount <= 0) { toast('Invalid amount', 'Enter a valid amount.', 'error'); return; }

    setSaving(true);
    try {
      await addExpense({ desc: f.desc, amount, date: f.date, category: f.category, method: f.method });
      toast('Expense added', `${fmt(amount, currency)} recorded.`);
      onBack();
    } catch (err) {
      toast('Could not save expense', err.message || 'Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page active">
      <div className="app-header-row">
        <div>
          <button className="btn btn-small btn-outline" onClick={onBack}><i className="fa-solid fa-arrow-left"></i> Back</button>
        </div>
      </div>

      <div className="panel section-gap">
        <h3 style={{ margin: 0 }}>Add Expense</h3>
        <div className="grid2 section-gap">
          <div className="field-sm"><label>Description</label><input value={f.desc} onChange={set('desc')} placeholder="Office Rent" /></div>
          <div className="field-sm"><label>Amount</label><input type="number" min="0" step="0.01" value={f.amount} onChange={set('amount')} placeholder="0.00" /></div>
          <div className="field-sm"><label>Date</label><input type="date" value={f.date} onChange={set('date')} /></div>
          <div className="field-sm"><label>Category</label>
            <select value={f.category} onChange={set('category')}>
              <option value="Rent">Rent</option><option value="Salaries">Salaries</option><option value="Supplies">Supplies</option>
              <option value="Purchases">Purchases (Cost of Goods)</option>
              <option value="Utilities">Utilities</option><option value="Marketing">Marketing</option><option value="Other">Other</option>
            </select>
          </div>
          <div className="field-sm"><label>Payment Method</label>
            <select value={f.method} onChange={set('method')}>
              <option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank Account">Bank Account</option>
            </select>
          </div>
        </div>
        <button className="btn btn-small btn-orange" onClick={submit} disabled={saving}>
          <i className="fa-solid fa-plus"></i> {saving ? 'Saving…' : 'Add Expense'}
        </button>
      </div>
    </div>
  );
}