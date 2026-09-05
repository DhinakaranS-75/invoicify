import { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { fmt } from '../utils/format';
import { registerNavGuard, clearNavGuard } from '../utils/navGuard';
import QuoteDocument from './QuoteDocument';
import ScaleToFit from './ScaleToFit';

const todayStr = () => new Date().toISOString().slice(0, 10);
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function nextQuoteNumber(quotes) {
  const n = (quotes?.length || 0) + 1;
  return `QUO-${String(n).padStart(3, '0')}`;
}

export default function QuoteForm({ editingId, onBack }) {
  const { currentUser, customers, catalogItems, quotes, addQuote, updateQuote, invoiceTemplate, companySignature, currency } = useData();
  const { toast } = useToast();
  const company = currentUser?.company || {};

  const editing = editingId ? quotes.find((q) => q.id === editingId) : null;
  const es = editing?.snapshot || {};

  const [tab, setTab] = useState('edit');

  const [from] = useState({
    name: company.name || '', email: company.email || currentUser?.email || '',
    phone: company.contact ? (company.contactCode || '') + ' ' + company.contact : '',
    address: [company.address, company.state].filter(Boolean).join(', ')
  });

  const [to, setTo] = useState({
    name: editing?.client || '', email: es.toEmail || '', phone: es.toPhone || '',
    address: es.toAddr || '', shipping: es.shipTo || ''
  });
  const [custSuggest, setCustSuggest] = useState(false);

  const [details, setDetails] = useState({
    number: editing?.number || nextQuoteNumber(quotes),
    subject: es.subject || '',
    date: editing?.date || todayStr(),
    validUntil: editing?.validUntil || plusDays(15),
    status: editing?.status || 'Draft'
  });

  const [items, setItems] = useState(
    (es.items && es.items.length)
      ? es.items.map((li) => ({ name: li.name || '', description: li.description || '', hsn: li.hsn || '', qty: li.qty || 1, rate: li.rate || 0 }))
      : [{ name: '', description: '', hsn: '', qty: 1, rate: 0 }]
  );
  const [itemSearch, setItemSearch] = useState('');
  const [itemSuggest, setItemSuggest] = useState(false);

  const [taxPct, setTaxPct] = useState(es.taxPct ?? 0);
  const [discountPct, setDiscountPct] = useState(es.discountPct ?? 0);
  const [notes, setNotes] = useState(editing ? (es.notes || '') : (company?.terms || ''));

  const totals = useMemo(() => {
    const withAmt = items.map((li) => ({ ...li, amount: (parseFloat(li.qty) || 0) * (parseFloat(li.rate) || 0) }));
    const subtotal = withAmt.reduce((s, li) => s + li.amount, 0);
    const taxAmt = subtotal * (parseFloat(taxPct) || 0) / 100;
    const discAmt = subtotal * (parseFloat(discountPct) || 0) / 100;
    const total = subtotal + taxAmt - discAmt;
    return { withAmt, subtotal, taxAmt, discAmt, total };
  }, [items, taxPct, discountPct]);

  const updateItem = (idx, key, val) => setItems((prev) => prev.map((li, i) => i === idx ? { ...li, [key]: val } : li));
  const addRow = () => setItems((prev) => [...prev, { name: '', description: '', hsn: '', qty: 1, rate: 0 }]);
  const removeRow = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const addCatalogItem = (it) => {
    setItems((prev) => {
      const rows = prev[0] && !prev[0].name ? prev.slice(1) : prev;
      return [...rows, { name: it.name, description: it.description || '', hsn: it.hsn || '', qty: 1, rate: it.sellingPrice || it.price || 0 }];
    });
    setItemSearch('');
    setItemSuggest(false);
  };

  const fullAddr = (a) => {
    if (!a) return '';
    const cityLine = a.city ? `${a.city},` : '';
    const statePin = a.pincode ? [a.state, a.pincode].filter(Boolean).join(' - ') : (a.state || '');
    return [a.street1, a.street2, cityLine, statePin].filter(Boolean).join('\n');
  };

  const pickCustomer = (c) => {
    setTo({
      name: c.name, email: c.email || '', phone: c.phone || '',
      address: fullAddr(c.billing) || c.address || '',
      shipping: fullAddr(c.shipping)
    });
    setCustSuggest(false);
  };

  const custMatches = customers.filter((c) => c.name.toLowerCase().includes(to.name.toLowerCase()));
  const itemMatches = catalogItems.filter((it) => it.name.toLowerCase().includes(itemSearch.toLowerCase()));

  const previewData = {
    quoteNumber: details.number, quoteDate: details.date, validUntil: details.validUntil,
    subject: details.subject, status: details.status,
    fromName: from.name, fromAddr: from.address, fromPhone: from.phone, fromEmail: from.email,
    gst: company.gst || '', logo: company.logo || null,
    toName: to.name, toAddr: to.address, toPhone: to.phone, toEmail: to.email, shipTo: to.shipping,
    items: totals.withAmt, subtotal: totals.subtotal, taxPct, taxAmt: totals.taxAmt,
    discPct: discountPct, discAmt: totals.discAmt, total: totals.total,
    notes, signature: companySignature
  };

  const save = async () => {
    if (!to.name.trim()) { toast('Customer required', 'Please fill the mandatory customer name.', 'error'); return; }
    const snapshot = {
      toEmail: to.email, toPhone: to.phone, toAddr: to.address, shipTo: to.shipping,
      subject: details.subject, notes, taxPct, discountPct, signature: companySignature,
      items: items.map((li) => ({ name: li.name, description: li.description, hsn: li.hsn || '', qty: parseFloat(li.qty) || 0, rate: parseFloat(li.rate) || 0 }))
    };
    const quoteObj = {
      number: details.number, date: details.date, validUntil: details.validUntil,
      client: to.name.trim(), status: details.status, total: totals.total, snapshot
    };
    try {
      if (editing) {
        await updateQuote(editing._id || editing.id, quoteObj);
        toast('Quote updated', `${details.number} saved.`);
      } else {
        await addQuote(quoteObj);
        toast('Quote saved', `${details.number} created as ${details.status}.`);
      }
      onBack();
    } catch (err) {
      toast('Save failed', err.message || 'Could not save the quote.', 'error');
    }
  };

  // ---- Unsaved-changes guard (mirrors InvoiceForm) ----
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const initialRef = useRef(null);
  const [pendingLeave, setPendingLeave] = useState(null);

  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => {
    const snap = JSON.stringify({ to, details, items, notes });
    if (initialRef.current === null) { initialRef.current = snap; return; }
    setDirty(snap !== initialRef.current);
  }, [to, details, items, notes]);

  useEffect(() => {
    registerNavGuard((proceed) => {
      if (dirtyRef.current) setPendingLeave(() => proceed);
      else proceed();
    });
    return () => clearNavGuard();
  }, []);

  useEffect(() => {
    const h = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const guardedBack = () => {
    if (dirtyRef.current) setPendingLeave(() => onBack);
    else onBack();
  };
  const leaveStay = () => setPendingLeave(null);
  const leaveDiscard = () => {
    const p = pendingLeave;
    dirtyRef.current = false;
    setDirty(false);
    setPendingLeave(null);
    if (p) p();
  };
  const leaveSave = async () => {
    dirtyRef.current = false;
    setDirty(false);
    setPendingLeave(null);
    await save();
  };

  return (
    <div className="page active">
      <div className="back-link" onClick={guardedBack}><i className="fa-solid fa-arrow-left"></i> Back to Quotes</div>
      <div className="app-header-row" style={{ marginBottom: '14px' }}>
        <div></div>
        <div className="tabs">
          <button className={tab === 'edit' ? 'active' : ''} onClick={() => setTab('edit')}>Edit</button>
          <button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Preview</button>
        </div>
      </div>

      <div className="workspace">
        <div className={'tab-panel' + (tab === 'edit' ? ' active' : '')}>
          <div className="panel">
            <div className="section-gap">
              <h3>Customer Name <span className="req-star">*</span></h3>
              <div className="autocomplete-wrap">
                <input
                  value={to.name}
                  placeholder="Type or select a saved customer"
                  autoComplete="off"
                  onChange={(e) => { setTo({ ...to, name: e.target.value }); setCustSuggest(true); }}
                  onFocus={() => setCustSuggest(true)}
                  onBlur={() => setTimeout(() => setCustSuggest(false), 150)}
                />
                {custSuggest && custMatches.length > 0 && (
                  <div className="autocomplete-list show">
                    {custMatches.slice(0, 6).map((c) => (
                      <div key={c.id} className="autocomplete-item" onMouseDown={() => pickCustomer(c)}>
                        <strong>{c.name}</strong>{c.email ? ' · ' + c.email : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid2 section-gap">
                <div className="field-sm"><label>Email</label><input value={to.email} onChange={(e) => setTo({ ...to, email: e.target.value })} placeholder="client@email.com" /></div>
                <div className="field-sm"><label>Phone</label><input value={to.phone} onChange={(e) => setTo({ ...to, phone: e.target.value })} placeholder="+91 90000 00000" /></div>
                <div className="field-sm"><label>Billing Address</label><textarea value={to.address} onChange={(e) => setTo({ ...to, address: e.target.value })} placeholder="Street, City, State - Pincode" rows={3} /></div>
                <div className="field-sm"><label>Shipping Address <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label><textarea value={to.shipping} onChange={(e) => setTo({ ...to, shipping: e.target.value })} placeholder="Street, City, State - Pincode" rows={3} /></div>
              </div>
            </div>

            <div className="section-gap">
              <h3>Quote Details</h3>
              <div className="grid2">
                <div className="field-sm"><label>Quote Number</label><input value={details.number} onChange={(e) => setDetails({ ...details, number: e.target.value })} /></div>
                <div className="field-sm"><label>Status</label>
                  <select value={details.status} onChange={(e) => setDetails({ ...details, status: e.target.value })}>
                    <option value="Draft">Draft</option><option value="Sent">Sent</option>
                    <option value="Accepted">Accepted</option><option value="Rejected">Rejected</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
              </div>
              <div className="field-sm"><label>Subject</label><input value={details.subject} onChange={(e) => setDetails({ ...details, subject: e.target.value })} placeholder="e.g. Website design services — July 2026" /></div>
              <div className="grid2">
                <div className="field-sm"><label>Quote Date</label><input type="date" value={details.date} onChange={(e) => setDetails({ ...details, date: e.target.value })} /></div>
                <div className="field-sm"><label>Valid Until</label><input type="date" value={details.validUntil} onChange={(e) => setDetails({ ...details, validUntil: e.target.value })} /></div>
              </div>
            </div>

            <div className="section-gap">
              <h3>Items</h3>
              <div className="autocomplete-wrap" style={{ marginBottom: '12px' }}>
                <input
                  value={itemSearch}
                  placeholder="🔍 Search & add item from catalog"
                  autoComplete="off"
                  onChange={(e) => { setItemSearch(e.target.value); setItemSuggest(true); }}
                  onFocus={() => setItemSuggest(true)}
                  onBlur={() => setTimeout(() => setItemSuggest(false), 150)}
                />
                {itemSuggest && itemMatches.length > 0 && (
                  <div className="autocomplete-list show">
                    {itemMatches.slice(0, 6).map((it) => (
                      <div key={it.id} className="autocomplete-item" onMouseDown={() => addCatalogItem(it)}>
                        <strong>{it.name}</strong> · {fmt(it.sellingPrice || it.price || 0, currency)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <table className="items-table">
                <thead><tr><th style={{ width: company.gst ? '32%' : '40%' }}>Item</th>{company.gst && <th style={{ width: '14%' }}>HSN/SAC</th>}<th style={{ width: '14%' }}>Qty</th><th style={{ width: '18%' }}>Rate</th><th style={{ width: '18%' }}>Amount</th><th style={{ width: '4%' }}></th></tr></thead>
                <tbody>
                  {items.map((li, idx) => (
                    <tr key={idx}>
                      <td><input value={li.name} onChange={(e) => updateItem(idx, 'name', e.target.value)} placeholder="Item name" /></td>
                      {company.gst && (
                        <td><input value={li.hsn} onChange={(e) => updateItem(idx, 'hsn', e.target.value)} placeholder="HSN/SAC" /></td>
                      )}
                      <td><input type="number" min="0" value={li.qty} onChange={(e) => updateItem(idx, 'qty', e.target.value)} /></td>
                      <td><input type="number" min="0" step="0.01" value={li.rate} onChange={(e) => updateItem(idx, 'rate', e.target.value)} /></td>
                      <td className="amt-col-cell"><span className="amt-col">{fmt((parseFloat(li.qty) || 0) * (parseFloat(li.rate) || 0), currency)}</span></td>
                      <td><button className="row-del" onClick={() => removeRow(idx)} title="Remove"><i className="fa-solid fa-trash-can"></i></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="add-item-btn" onClick={addRow}><i className="fa-solid fa-plus"></i> Add Item Manually</button>

              <div className="totals">
                <div className="row"><span>Subtotal</span><span>{fmt(totals.subtotal, currency)}</span></div>
                <div className="row"><span>Tax (%)</span><input type="number" value={taxPct} min="0" onChange={(e) => setTaxPct(e.target.value)} /></div>
                <div className="row"><span>Discount (%)</span><input type="number" value={discountPct} min="0" onChange={(e) => setDiscountPct(e.target.value)} /></div>
                <div className="row grand"><span>Total</span><span>{fmt(totals.total, currency)}</span></div>
              </div>
            </div>

            <div className="section-gap">
              <div className="field-sm"><label>Notes / Validity Terms</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. This quote is valid for 15 days. Prices subject to change thereafter."></textarea></div>
            </div>

            <div className="actions-row">
              <button className="btn btn-small btn-teal" onClick={save}><i className="fa-solid fa-floppy-disk"></i> Save Quote</button>
              <button className="btn btn-small btn-outline" onClick={guardedBack}><i className="fa-solid fa-xmark"></i> Cancel</button>
            </div>
          </div>
        </div>

        <div className={'tab-panel' + (tab === 'preview' ? ' active' : '')}>
          <div id="quote-preview">
            <ScaleToFit>
              <QuoteDocument data={previewData} template={invoiceTemplate} currency={currency} />
            </ScaleToFit>
          </div>
        </div>
      </div>

      <div className={'confirm-overlay' + (pendingLeave ? ' show' : '')}>
        <div className="confirm-box">
          <div className="confirm-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
          <h3>Unsaved changes</h3>
          <p>You have unsaved changes on this quote. What would you like to do?</p>
          <div className="confirm-actions">
            <button className="btn btn-small btn-teal" onClick={leaveSave}><i className="fa-solid fa-floppy-disk"></i> Save &amp; Leave</button>
            <button className="btn btn-small" style={{ background: 'var(--danger)', color: '#fff' }} onClick={leaveDiscard}><i className="fa-solid fa-trash-can"></i> Discard</button>
            <button className="btn btn-small btn-outline" onClick={leaveStay}>Stay</button>
          </div>
        </div>
      </div>
    </div>
  );
}