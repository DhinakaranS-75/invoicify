import { useState, useMemo, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useClickOutside } from '../hooks/useClickOutside';
import { usePermissions } from '../hooks/usePermissions';
import { fmt, statusBadgeClass } from '../utils/format';
import QuoteForm from '../components/QuoteForm';
import QuoteDetail from '../components/QuoteDetail';

export default function Quotes() {
  const { quotes, deleteQuote, currency } = useData();
  const { toast } = useToast();
  const { can } = usePermissions();

  const [view, setView] = useState('dashboard');
  const [editingId, setEditingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [menuFor, setMenuFor] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const totalValue = quotes.reduce((s, q) => s + (q.total || 0), 0);
  const acceptedCount = quotes.filter((q) => q.status === 'Accepted').length;

  const openNew = () => { setEditingId(null); setView('form'); };
  const openEdit = (id) => { setEditingId(id); setView('form'); };
  const openDetail = (id) => { setViewingId(id); setView('detail'); };
  const backToDashboard = () => { setView('dashboard'); setEditingId(null); setViewingId(null); };

  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleSelectAll = (checked) => setSelected(checked ? new Set(quotes.map((q) => q.id)) : new Set());
  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteQuote(pendingDelete.id);
    toast('Quote deleted', `${pendingDelete.number || 'Quote'} was removed.`, 'delete');
    setPendingDelete(null);
  };
  const bulkDelete = () => {
    [...selected].forEach((id) => deleteQuote(id));
    toast('Quotes deleted', `${selected.size} removed.`, 'delete');
    setSelected(new Set());
  };

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const queryFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter((quo) => {
      const haystack = [quo.number, quo.client, quo.status, quo.date, quo.validUntil, quo.total != null ? String(quo.total) : '']
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [quotes, query]);

  const STATUS_ORDER = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted'];
  const statusCounts = useMemo(() => {
    const c = {};
    queryFiltered.forEach((quo) => { const st = quo.status || 'Draft'; c[st] = (c[st] || 0) + 1; });
    return c;
  }, [queryFiltered]);

  const visibleQuotes = useMemo(() => {
    if (statusFilter === 'all') return queryFiltered;
    return queryFiltered.filter((quo) => (quo.status || 'Draft') === statusFilter);
  }, [queryFiltered, statusFilter]);

  const clearSearch = () => { setQuery(''); setSearchOpen(false); };
  const searchRef = useClickOutside(useCallback(() => setSearchOpen(false), []), searchOpen);

  if (view === 'form') {
    return <QuoteForm editingId={editingId} onBack={backToDashboard} />;
  }
  if (view === 'detail') {
    return <QuoteDetail quoteId={viewingId} onBack={backToDashboard} onEdit={openEdit} onView={openDetail} />;
  }

  return (
    <div className="page active">
      <div className="app-header-row inv-page-header">
        <div><h1 className="hide-mobile">Quotes</h1><p className="hide-mobile">Send quick estimates and turn accepted ones into invoices.</p></div>
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
            <button className="btn btn-small btn-orange hide-mobile" onClick={openNew}><i className="fa-solid fa-plus"></i> Create New Quote</button>
          )}
        </div>
      </div>

      <div className="stat-grid hide-mobile" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card"><div className="stat-label">Quotes</div><div className="stat-value">{quotes.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total Value</div><div className="stat-value">{fmt(totalValue, currency)}</div></div>
        <div className="stat-card"><div className="stat-label">Accepted</div><div className="stat-value">{acceptedCount}</div></div>
      </div>

      <div className="panel">
        <div className="panel-head-row">
          <h3>
            Saved Quotes
            {(query || statusFilter !== 'all') && <span className="inv-search-count">{visibleQuotes.length} of {quotes.length}</span>}
          </h3>
          <div className={'inv-search' + (searchOpen ? ' open' : '')} ref={searchRef}>
            <button className="inv-search-toggle" onClick={() => setSearchOpen((o) => !o)} title="Search quotes" aria-label="Search quotes">
              <i className="fa-solid fa-magnifying-glass"></i>
            </button>
            <input
              type="search" className="inv-search-input" value={query}
              onChange={(e) => setQuery(e.target.value)} placeholder="Quote # or customer…" aria-label="Search quotes"
            />
            {query && (
              <button className="inv-search-clear" onClick={clearSearch} title="Clear" aria-label="Clear search">
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </div>

        {quotes.length > 0 && (
          <div className="inv-filters">
            <button className={'inv-filter' + (statusFilter === 'all' ? ' active' : '')} onClick={() => setStatusFilter('all')}>
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
                <th style={{ width: '34px' }}><input type="checkbox" checked={quotes.length > 0 && selected.size === quotes.length} onChange={(e) => toggleSelectAll(e.target.checked)} /></th>
                <th>Quote #</th><th>Date</th><th>Customer</th><th>Status</th><th>Valid Until</th><th>Amount</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleQuotes.length === 0 ? (
                <tr><td colSpan="8"><p className="empty-line" style={{ fontSize: '13px', margin: 0 }}>
                  {(query || statusFilter !== 'all') ? 'No quotes match these filters.' : 'No quotes yet — create your first one.'}
                </p></td></tr>
              ) : visibleQuotes.slice().reverse().map((quo) => {
                const status = quo.status || 'Draft';
                return (
                  <tr key={quo.id} className="inv-row">
                    <td><input type="checkbox" checked={selected.has(quo.id)} onChange={() => toggleSelect(quo.id)} /></td>
                    <td className="link-col" onClick={() => openDetail(quo.id)}>{quo.number}</td>
                    <td>{quo.date || '—'}</td>
                    <td>{quo.client}</td>
                    <td><span className={'status-badge ' + statusBadgeClass(status)}>{status}</span></td>
                    <td>{quo.validUntil || '—'}</td>
                    <td className="amt-col">{fmt(quo.total, currency)}</td>
                    <td>—</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mobile-invoice-cards show-mobile">
          {visibleQuotes.length === 0 ? (
            <p className="empty-line" style={{ fontSize: '13px' }}>
              {(query || statusFilter !== 'all') ? 'No quotes match these filters.' : 'No quotes yet — tap + to create one.'}
            </p>
          ) : visibleQuotes.slice().reverse().map((quo) => {
            const status = quo.status || 'Draft';
            return (
              <div className="mobile-inv-card" key={quo.id} onClick={() => openDetail(quo.id)}>
                <div className="mic-left">
                  <div className="mic-customer">{quo.client}</div>
                  <div className="mic-meta">
                    <span>Quote #{quo.number}</span><br />
                    <span>Valid until {quo.validUntil || '—'}</span><br />
                    <span>{quo.date || '—'}</span>
                  </div>
                </div>
                <div className="mic-right">
                  <span className={'status-badge ' + statusBadgeClass(status)}>{status}</span>
                  <span className="mic-amount">{fmt(quo.total, currency)}</span>
                </div>

                <button
                  className="mic-kebab"
                  aria-label="Quote actions"
                  onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === quo.id ? null : quo.id); }}
                >
                  <i className="fa-solid fa-ellipsis-vertical"></i>
                </button>

                {menuFor === quo.id && (
                  <div className="mic-menu" onClick={(e) => e.stopPropagation()}>
                    {can('editInvoice') && (
                      <button onClick={() => { setMenuFor(null); openEdit(quo.id); }}>
                        <i className="fa-solid fa-pen"></i> Edit
                      </button>
                    )}
                    {can('editInvoice') && (
                      <button className="mic-menu-danger" onClick={() => { setMenuFor(null); setPendingDelete(quo); }}>
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
            <h3>Delete {pendingDelete.number || 'this quote'}?</h3>
            <p>This quote{pendingDelete.client ? ` for ${pendingDelete.client}` : ''} will be permanently removed. This can't be undone.</p>
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
        <button className="fab" onClick={openNew} title="Create New Quote"><i className="fa-solid fa-plus"></i></button>
      )}
    </div>
  );
}