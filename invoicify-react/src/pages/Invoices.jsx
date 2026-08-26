import { useState, useMemo, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useClickOutside } from '../hooks/useClickOutside';
import { usePermissions } from '../hooks/usePermissions';
import { fmt, statusBadgeClass, paymentMethodIcon } from '../utils/format';
import InvoiceForm from '../components/InvoiceForm';
import InvoiceDetail from '../components/InvoiceDetail';

function invoicePaymentMethod(inv) {
  if (!inv.payments || !inv.payments.length) return '';
  return inv.payments[inv.payments.length - 1].method || '';
}

export default function Invoices() {
  const { invoices, duplicateInvoice, deleteInvoice, currency } = useData();
  const { toast } = useToast();
  const { can } = usePermissions();

  // view: dashboard | form | detail ; editingId / viewingId track context
  const [view, setView] = useState('dashboard');
  const [editingId, setEditingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [menuFor, setMenuFor] = useState(null);       // mobile card whose ⋮ menu is open
  const [pendingDelete, setPendingDelete] = useState(null); // invoice awaiting delete confirm

  const totalRevenue = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const avgInvoice = invoices.length ? totalRevenue / invoices.length : 0;

  const openNew = () => { setEditingId(null); setView('form'); };
  const openEdit = (id) => { setEditingId(id); setView('form'); };
  const openDetail = (id) => { setViewingId(id); setView('detail'); };
  const backToDashboard = () => { setView('dashboard'); setEditingId(null); setViewingId(null); };

  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleSelectAll = (checked) => setSelected(checked ? new Set(invoices.map((i) => i.id)) : new Set());
  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteInvoice(pendingDelete.id);
    toast('Invoice deleted', `${pendingDelete.number || 'Invoice'} was removed.`, 'delete');
    setPendingDelete(null);
  };

  const bulkDelete = () => {
    [...selected].forEach((id) => deleteInvoice(id));
    toast('Invoices deleted', `${selected.size} removed.`, 'delete');
    setSelected(new Set());
  };

  // ---- Search --------------------------------------------------------
  // Matches invoice number, order number and customer name — the three
  // things you actually have to hand when a customer rings up asking for
  // a copy. Amount is included too since people often remember the figure.
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false); // mobile: icon expands the field

  const [statusFilter, setStatusFilter] = useState('all'); // all | Draft | Sent | Unpaid | Overdue | Paid

  // First narrow by the search box...
  const queryFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const haystack = [
        inv.number, inv.orderNumber, inv.client,
        inv.status, inv.date, inv.dueDate,
        inv.total != null ? String(inv.total) : ''
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [invoices, query]);

  // ...then count each status within those results, so the pills reflect what
  // the current search actually contains.
  const STATUS_ORDER = ['Draft', 'Sent', 'Unpaid', 'Overdue', 'Paid'];
  const statusCounts = useMemo(() => {
    const c = {};
    queryFiltered.forEach((inv) => {
      const st = inv.status || 'Unpaid';
      c[st] = (c[st] || 0) + 1;
    });
    return c;
  }, [queryFiltered]);

  // ...finally apply the chosen status pill.
  const visibleInvoices = useMemo(() => {
    if (statusFilter === 'all') return queryFiltered;
    return queryFiltered.filter((inv) => (inv.status || 'Unpaid') === statusFilter);
  }, [queryFiltered, statusFilter]);

  const clearSearch = () => { setQuery(''); setSearchOpen(false); };
  // On mobile the search box expands from an icon; collapse it when the user
  // taps outside (the query is kept, just like the profile menu closing).
  const searchRef = useClickOutside(useCallback(() => setSearchOpen(false), []), searchOpen);

  if (view === 'form') {
    return <InvoiceForm editingId={editingId} onBack={backToDashboard} />;
  }
  if (view === 'detail') {
    return <InvoiceDetail invoiceId={viewingId} onBack={backToDashboard} onEdit={openEdit} onView={openDetail} />;
  }

  return (
    <div className="page active">
      <div className="app-header-row inv-page-header">
        <div><h1 className="hide-mobile">Invoices</h1><p className="hide-mobile">Create, preview and download professional invoices in seconds.</p></div>
        <div className="header-actions">

          {selected.size > 0 && can('editInvoice') && (
            <button className="btn btn-small" style={{ background: 'var(--danger)', color: '#fff' }} onClick={bulkDelete}>
              <i className="fa-solid fa-trash-can"></i> Delete ({selected.size})
            </button>
          )}
          {selected.size === 1 && can('editInvoice') && (
            <button className="btn btn-small btn-teal" onClick={() => openEdit([...selected][0])}>
              <i className="fa-solid fa-pen"></i> Edit
            </button>
          )}

      {can('createInvoice') && (
            <button className="btn btn-small btn-orange hide-mobile" onClick={openNew}><i className="fa-solid fa-plus"></i> Create New Invoice</button>
          )}
        </div>
      </div>

      <div className="stat-grid hide-mobile" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card"><div className="stat-label">Invoices</div><div className="stat-value">{invoices.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total Revenue</div><div className="stat-value">{fmt(totalRevenue, currency)}</div></div>
        <div className="stat-card"><div className="stat-label">Average Invoice</div><div className="stat-value">{fmt(avgInvoice, currency)}</div></div>
      </div>

      <div className="panel">
        <div className="panel-head-row">
          <h3>
            Saved Invoices
            {(query || statusFilter !== 'all') && <span className="inv-search-count">{visibleInvoices.length} of {invoices.length}</span>}
          </h3>
          <div className={'inv-search' + (searchOpen ? ' open' : '')} ref={searchRef}>
            <button
              className="inv-search-toggle"
              onClick={() => setSearchOpen((o) => !o)}
              title="Search invoices"
              aria-label="Search invoices"
            >
              <i className="fa-solid fa-magnifying-glass"></i>
            </button>
            <input
              type="search"
              className="inv-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Invoice #, order # or customer…"
              aria-label="Search invoices"
            />
            {query && (
              <button className="inv-search-clear" onClick={clearSearch} title="Clear" aria-label="Clear search">
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </div>


        {/* Status filter pills — combine with the search box above */}
        {invoices.length > 0 && (
          <div className="inv-filters">
            <button
              className={'inv-filter' + (statusFilter === 'all' ? ' active' : '')}
              onClick={() => setStatusFilter('all')}
            >
              All <span className="inv-filter-count">{queryFiltered.length}</span>
            </button>
            {STATUS_ORDER.filter((st) => statusCounts[st]).map((st) => (
              <button
                key={st}
                className={'inv-filter inv-filter-' + st.toLowerCase() + (statusFilter === st ? ' active' : '')}
                onClick={() => setStatusFilter((cur) => (cur === st ? 'all' : st))}
              >
                {st} <span className="inv-filter-count">{statusCounts[st]}</span>
              </button>
            ))}
          </div>
        )}
        <div className="hide-mobile" style={{ overflowX: 'auto' }}>
          <table className="invoice-dash-table">
            <thead>
              <tr>
                <th style={{ width: '34px' }}><input type="checkbox" checked={invoices.length > 0 && selected.size === invoices.length} onChange={(e) => toggleSelectAll(e.target.checked)} /></th>
                <th>Invoice #</th><th>Order #</th><th>Date</th><th>Customer</th><th>Status</th>
                <th>Due Date</th><th>Amount</th><th>Balance</th><th>Payment</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.length === 0 ? (
                <tr><td colSpan="11"><p className="empty-line" style={{ fontSize: '13px', margin: 0 }}>
                  {(query || statusFilter !== 'all') ? 'No invoices match these filters.' : 'No invoices yet — create your first one.'}
                </p></td></tr>
              ) : visibleInvoices.slice().reverse().map((inv) => {
                const status = inv.status || 'Unpaid';
                const paid = (inv.payments || []).reduce((s, p) => s + p.amount, 0);
                const balance = status === 'Paid' ? 0 : Math.max(0, inv.total - paid);
                const method = invoicePaymentMethod(inv);
                return (
                  <tr key={inv.id} className="inv-row">
                    <td><input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleSelect(inv.id)} /></td>
                    <td className="link-col" onClick={() => openDetail(inv.id)}>{inv.number}</td>
                    <td>{inv.orderNumber || '—'}</td>
                    <td>{inv.date || '—'}</td>
                    <td>{inv.client}</td>
                    <td><span className={'status-badge ' + statusBadgeClass(status)}>{status}</span></td>
                    <td>{inv.dueDate || '—'}</td>
                    <td className="amt-col">{fmt(inv.total, currency)}</td>
                    <td className="amt-col">{fmt(balance, currency)}</td>
                    <td>{method ? <span className="pay-method-tag"><i className={'fa-solid ' + paymentMethodIcon(method)}></i> {method}</span> : <span style={{ color: 'var(--muted)', fontSize: '12px' }}>—</span>}</td>
                    <td><button className="row-action-btn" title="Duplicate" onClick={() => { duplicateInvoice(inv.id); toast('Invoice duplicated', 'A copy was created as Draft.'); }}><i className="fa-solid fa-copy"></i></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="mobile-invoice-cards show-mobile">
          {visibleInvoices.length === 0 ? (
            <p className="empty-line" style={{ fontSize: '13px' }}>
              {(query || statusFilter !== 'all') ? 'No invoices match these filters.' : 'No invoices yet — tap + to create one.'}
            </p>
          ) : visibleInvoices.slice().reverse().map((inv) => {
            const status = inv.status || 'Unpaid';
            const method = invoicePaymentMethod(inv);
            return (
              <div className="mobile-inv-card" key={inv.id} onClick={() => openDetail(inv.id)}>
                <div className="mic-left">
                  <div className="mic-customer">{inv.client}</div>
                  <div className="mic-meta">
                    <span>Inv #{inv.number}</span><br />
                    <span>Order #{inv.orderNumber || '—'}</span><br />
                    <span>{inv.date || '—'}</span>
                  </div>
                </div>
                <div className="mic-right">
                  <span className={'status-badge ' + statusBadgeClass(status)}>{status}</span>
                  <span className="mic-amount">{fmt(inv.total, currency)}</span>
                  {method && <span className="pay-method-tag"><i className={'fa-solid ' + paymentMethodIcon(method)}></i> {method}</span>}
                </div>

                {/* ⋮ actions — stops the card's open-detail tap */}
                <button
                  className="mic-kebab"
                  aria-label="Invoice actions"
                  onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === inv.id ? null : inv.id); }}
                >
                  <i className="fa-solid fa-ellipsis-vertical"></i>
                </button>

                {menuFor === inv.id && (
                  <div className="mic-menu" onClick={(e) => e.stopPropagation()}>
                    {can('editInvoice') && (
                      <button onClick={() => { setMenuFor(null); openEdit(inv.id); }}>
                        <i className="fa-solid fa-pen"></i> Edit
                      </button>
                    )}
                    {can('createInvoice') && (
                      <button onClick={() => { setMenuFor(null); duplicateInvoice(inv.id); toast('Invoice duplicated', 'A copy was created as Draft.'); }}>
                        <i className="fa-solid fa-copy"></i> Duplicate
                      </button>
                    )}
                    {can('editInvoice') && (
                      <button className="mic-menu-danger" onClick={() => { setMenuFor(null); setPendingDelete(inv); }}>
                        <i className="fa-solid fa-trash-can"></i> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {menuFor && <div className="mic-menu-backdrop" onClick={() => setMenuFor(null)}></div>}
        </div>
      </div>

          {pendingDelete && (
        <div className="confirm-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setPendingDelete(null); }}>
          <div className="confirm-box">
            <div className="confirm-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
            <h3>Delete {pendingDelete.number || 'this invoice'}?</h3>
            <p>This invoice{pendingDelete.client ? ` for ${pendingDelete.client}` : ''} will be permanently removed. This can't be undone.</p>
            <div className="confirm-actions">
              <button className="btn btn-small" style={{ background: 'var(--danger)', color: '#fff' }} onClick={confirmDelete}>
                <i className="fa-solid fa-trash-can"></i> Delete
              </button>
              <button className="btn btn-small btn-outline" onClick={() => setPendingDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {can('createInvoice') && (
        <button className="fab" onClick={openNew} title="Create New Invoice"><i className="fa-solid fa-plus"></i></button>
      )}
    </div>
  );
}