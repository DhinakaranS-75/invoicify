import { useState, useMemo, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { fmt } from '../utils/format';
import { buildInvoiceNumber } from '../utils/invoiceNumber';
import { registerNavGuard, clearNavGuard } from '../utils/navGuard';
import InvoiceDocument from './InvoiceDocument';
import ScaleToFit from './ScaleToFit';
import PaymentConflictDialog from './PaymentConflictDialog';

const todayStr = () => new Date().toISOString().slice(0, 10);
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export default function InvoiceForm({ editingId, onBack }) {
  const {
    currentUser, customers, catalogItems, invoices,
    addInvoice, updateInvoice, nextInvoiceNumber, invoiceTemplate, companySignature, currency,
    invoiceNumberConfig, setInvoiceNumberConfig
  } = useData();
  const { toast } = useToast();
  const company = currentUser?.company || {};

  const editing = editingId ? invoices.find((i) => i.id === editingId) : null;
  const es = editing?.snapshot || {};

  const [tab, setTab] = useState('edit');

  // Bill From (prefilled from company)
  const [from, setFrom] = useState({
    name: company.name || '', email: company.email || currentUser?.email || '',
    phone: company.contact ? (company.contactCode || '') + ' ' + company.contact : '',
    address: [company.address, company.state].filter(Boolean).join(', ')
  });

  // Customer
  const [to, setTo] = useState({
    name: editing?.client || '', email: es.toEmail || '', phone: es.toPhone || '',
    address: es.toAddr || '', shipping: es.shipTo || ''
  });
  const [custSuggest, setCustSuggest] = useState(false);

  // Invoice details
  const [details, setDetails] = useState({
    number: editing?.number || nextInvoiceNumber(),
    orderNumber: editing?.orderNumber || `ORD-${String(invoiceNumberConfig?.next || 1).padStart(4, '0')}`,
    subject: es.subject || '',
    date: editing?.date || todayStr(),
    due: editing?.dueDate || plusDays(15),
    status: editing?.status || 'Draft'
  });

  // Invoice-number customizer modal (opens from the gear inside the Invoice Number field)
  const [numDialog, setNumDialog] = useState(false);
  const [numberError, setNumberError] = useState(false); // duplicate invoice number
  // Live availability of the invoice number: idle | checking | ok | taken
  const [numberStatus, setNumberStatus] = useState('idle');

  // Ask the server whether the typed invoice number is free, 500ms after the
  // user stops typing. Skipped while empty. On an edit we pass excludeId so the
  // invoice's own number doesn't count as a clash.
  useEffect(() => {
    const num = (details?.number || '').trim();
    if (!num) { setNumberStatus('idle'); return undefined; }
    setNumberStatus('checking');
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ number: num });
        if (editing) qs.set('excludeId', editing._id || editing.id);
        const res = await api.get('/api/invoices/check-number?' + qs.toString());
        if (cancelled) return;
        setNumberStatus(res.available ? 'ok' : 'taken');
        setNumberError(res.available ? false : true);
      } catch {
        if (!cancelled) setNumberStatus('idle'); // network hiccup: stay quiet, save still guards
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [details.number, editing]);

  const [numCfg, setNumCfg] = useState(invoiceNumberConfig);
  const openNumberDialog = () => { setNumCfg(invoiceNumberConfig); setNumDialog(true); };
  const numCfgSet = (k) => (e) => setNumCfg((p) => ({ ...p, [k]: e.target.value }));
  const cleanNumCfg = () => ({
    ...numCfg,
    prefix: (numCfg.prefix || '').trim() || 'INV',
    middle: (numCfg.middle || '').trim(),
    padding: parseInt(numCfg.padding) || 0,
    next: parseInt(numCfg.next) || 1
  });
  const numPreview = buildInvoiceNumber(cleanNumCfg());
  const applyNumberFormat = () => {
    const clean = cleanNumCfg();
    setInvoiceNumberConfig(clean);
    const newNum = buildInvoiceNumber(clean);
    setDetails((d) => ({ ...d, number: newNum }));
    setNumDialog(false);
    toast('Format applied', `Invoice number set to ${newNum}.`);
  };

  // Items
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

  // ---- Calculations ----
  const totals = useMemo(() => {
    const withAmt = items.map((li) => ({ ...li, amount: (parseFloat(li.qty) || 0) * (parseFloat(li.rate) || 0) }));
    const subtotal = withAmt.reduce((s, li) => s + li.amount, 0);
    const taxAmt = subtotal * (parseFloat(taxPct) || 0) / 100;
    const discAmt = subtotal * (parseFloat(discountPct) || 0) / 100;
    const total = subtotal + taxAmt - discAmt;
    return { withAmt, subtotal, taxAmt, discAmt, total };
  }, [items, taxPct, discountPct]);

  // ---- Item row helpers ----
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

  // ---- Preview data ----
  const previewData = {
    invNumber: details.number, invDate: details.date, invDue: details.due,
    orderNumber: details.orderNumber, subject: details.subject, status: details.status,
    fromName: from.name, fromAddr: from.address, fromPhone: from.phone, fromEmail: from.email,
    gst: company.gst || '', logo: company.logo || null,
    bankName: company.bankName, accountNumber: company.accountNumber, ifsc: company.ifsc,
    upiId: company.upiId || '',
    toName: to.name, toAddr: to.address, toPhone: to.phone, toEmail: to.email, shipTo: to.shipping,
    items: totals.withAmt, subtotal: totals.subtotal, taxPct, taxAmt: totals.taxAmt,
    discPct: discountPct, discAmt: totals.discAmt, total: totals.total,
    notes, signature: companySignature
  };

  // ---- Save ----
  // Set when saving would leave a paid invoice sitting on a non-Paid status.
  const [payConflict, setPayConflict] = useState(null); // { invoiceObj, paidSum }

  const save = async () => {
    if (!to.name.trim()) { toast('Customer required', 'Please fill the mandatory customer name.', 'error'); return; }
    const snapshot = {
      toEmail: to.email, toPhone: to.phone, toAddr: to.address, shipTo: to.shipping,
      subject: details.subject, orderNumber: details.orderNumber,
      notes, taxPct, discountPct, signature: companySignature,
      items: items.map((li) => ({ name: li.name, description: li.description, hsn: li.hsn || '', qty: parseFloat(li.qty) || 0, rate: parseFloat(li.rate) || 0 }))
    };
    const existingPayments = editing?.payments || [];
    const invoiceObj = {
      number: details.number, orderNumber: details.orderNumber, date: details.date,
      dueDate: details.due, client: to.name.trim(), status: details.status,
      total: totals.total, snapshot, payments: existingPayments
    };

    const paidSum = existingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    if (editing && paidSum > 0 && details.status !== 'Paid') {
      setPayConflict({ invoiceObj, paidSum });
      return;
    }
    await commitSave(invoiceObj);
  };

  const commitSave = async (invoiceObj) => {
    setPayConflict(null);
    try {
      if (editing) {
        await updateInvoice(editing._id || editing.id, invoiceObj);
        toast('Invoice updated', `${details.number} saved.`);
      } else {
        await addInvoice(invoiceObj);
        toast('Invoice saved', `${details.number} created as ${details.status}.`);
      }
      onBack();
    } catch (err) {
      // Backend rejects a number already used in this company (GST needs them
      // unique). Keep the form open and point the user at the number field.
      if (err && (err.code === 'DUPLICATE_NUMBER' || /already used/i.test(err.message || ''))) {
        setNumberError(true);
        setTab('edit');
        toast('Duplicate invoice number', err.message || `Invoice number ${details.number} is already used.`, 'error');
        return;
      }
      toast('Save failed', err.message || 'Could not save the invoice.', 'error');
    }
  };

  // ---- Unsaved-changes guard ----
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const initialRef = useRef(null);
  const [pendingLeave, setPendingLeave] = useState(null); // the action to run when leaving

  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  // Detect real edits by comparing against the first snapshot (StrictMode-safe).
  useEffect(() => {
    const snap = JSON.stringify({ to, details, items, notes });
    if (initialRef.current === null) { initialRef.current = snap; return; }
    setDirty(snap !== initialRef.current);
  }, [to, details, items, notes]);

  // Intercept in-app navigation (bottom nav / sidebar) while there are edits.
  useEffect(() => {
    registerNavGuard((proceed) => {
      if (dirtyRef.current) setPendingLeave(() => proceed);
      else proceed();
    });
    return () => clearNavGuard();
  }, []);

  // Warn on browser tab close / refresh.
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
    await save(); // persists + returns to the invoices list
  };

  return (
    <div className="page active">
      <div className="back-link" onClick={guardedBack}><i className="fa-solid fa-arrow-left"></i> Back to Invoices</div>
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
              <h3>Bill From</h3>
              <div className="grid2">
                <div className="field-sm"><label>Business Name</label><input value={from.name} onChange={(e) => setFrom({ ...from, name: e.target.value })} placeholder="Your Company Pvt Ltd" /></div>
                <div className="field-sm"><label>Email</label><input value={from.email} onChange={(e) => setFrom({ ...from, email: e.target.value })} placeholder="you@company.com" /></div>
                <div className="field-sm"><label>Phone</label><input value={from.phone} onChange={(e) => setFrom({ ...from, phone: e.target.value })} placeholder="+91 98765 43210" /></div>
                <div className="field-sm"><label>Address</label><input value={from.address} onChange={(e) => setFrom({ ...from, address: e.target.value })} placeholder="City, State" /></div>
              </div>

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
                <h3>Invoice Details</h3>
                <div className="grid2">
                  <div className="field-sm">
                    <label>Invoice Number</label>
                    <div className="input-with-icon">
                      <input className={numberError ? 'invalid' : ''} value={details.number} onChange={(e) => { setNumberError(false); setDetails({ ...details, number: e.target.value }); }} />
                      <button type="button" className="input-icon-btn" title="Customize invoice number" onClick={openNumberDialog}><i className="fa-solid fa-gear"></i></button>
                    </div>
                    {numberStatus === 'checking' && <div className="num-hint num-checking"><i className="fa-solid fa-circle-notch fa-spin"></i> Checking…</div>}
                    {numberStatus === 'ok' && <div className="num-hint num-ok"><i className="fa-solid fa-circle-check"></i> Available</div>}
                    {numberStatus === 'taken' && <div className="num-hint num-taken"><i className="fa-solid fa-circle-exclamation"></i> Already used — pick another</div>}
                  </div>
                  <div className="field-sm"><label>Order Number</label><input value={details.orderNumber} onChange={(e) => setDetails({ ...details, orderNumber: e.target.value })} placeholder="ORD-0001" /></div>
                </div>
                <div className="field-sm"><label>Subject</label><input value={details.subject} onChange={(e) => setDetails({ ...details, subject: e.target.value })} placeholder="e.g. Website design services — July 2026" /></div>
                <div className="grid2">
                  <div className="field-sm"><label>Invoice Date</label><input type="date" value={details.date} onChange={(e) => setDetails({ ...details, date: e.target.value })} /></div>
                  <div className="field-sm"><label>Due Date</label><input type="date" value={details.due} onChange={(e) => setDetails({ ...details, due: e.target.value })} /></div>
                  <div className="field-sm"><label>Status</label>
                    <select value={details.status} onChange={(e) => setDetails({ ...details, status: e.target.value })}>
                      <option value="Draft">Draft</option><option value="Sent">Sent</option><option value="Unpaid">Unpaid</option><option value="Paid">Paid</option><option value="Overdue">Overdue</option>
                    </select>
                  </div>
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
                <div className="field-sm"><label>Notes / Payment Terms</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Payment due within 15 days. Thank you for your business!"></textarea></div>
              </div>

              <div className="actions-row">
                <button className="btn btn-small btn-teal" onClick={save}><i className="fa-solid fa-floppy-disk"></i> Save Invoice</button>
                <button className="btn btn-small btn-outline" onClick={guardedBack}><i className="fa-solid fa-xmark"></i> Cancel</button>
              </div>
            </div>
        </div>

        <div className={'tab-panel' + (tab === 'preview' ? ' active' : '')}>
          <div id="invoice-preview">
            <ScaleToFit>
              <InvoiceDocument data={previewData} template={invoiceTemplate} currency={currency} />
            </ScaleToFit>
          </div>
        </div>
      </div>

      {/* Customize Invoice Number — popup modal (matches the original single-file design) */}
      <div className={'confirm-overlay' + (numDialog ? ' show' : '')} onClick={(e) => { if (e.target === e.currentTarget) setNumDialog(false); }}>
        <div className="confirm-box" style={{ maxWidth: '440px', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div className="confirm-icon" style={{ margin: 0, width: '44px', height: '44px', fontSize: '18px' }}><i className="fa-solid fa-hashtag"></i></div>
            <h3 style={{ margin: 0 }}>Customize Invoice Number</h3>
          </div>
          <p style={{ margin: '10px 0 18px' }}>Set your own format. The number part will auto-increment on each new invoice.</p>
          <div className="invnum-grid">
            <div className="field-sm"><label>Prefix</label><input value={numCfg.prefix} onChange={numCfgSet('prefix')} placeholder="INV" /></div>
            <div className="field-sm"><label>Middle</label><input value={numCfg.middle || ''} onChange={numCfgSet('middle')} placeholder="2026 or COM" /></div>
          </div>
          <div className="invnum-help">Prefix is required · Middle is optional (year or company code)</div>
          <div className="invnum-grid">
            <div className="field-sm"><label>Separator</label>
              <select value={numCfg.separator} onChange={numCfgSet('separator')}>
                <option value="-">- (dash)</option>
                <option value="/">/ (slash)</option>
                <option value="">none</option>
              </select>
            </div>
            <div className="field-sm"><label>Next Number</label><input type="number" min="1" value={numCfg.next} onChange={numCfgSet('next')} /></div>
          </div>
          <div className="field-sm" style={{ marginTop: '14px' }}><label>Number Padding (digits)</label>
            <select value={String(numCfg.padding)} onChange={numCfgSet('padding')}>
              <option value="0">No padding (1)</option>
              <option value="3">3 digits (001)</option>
              <option value="4">4 digits (0001)</option>
              <option value="5">5 digits (00001)</option>
            </select>
          </div>
          <div className="invnum-preview">Preview: <strong>{numPreview}</strong></div>
          <div className="invnum-tips">
            <div className="tips-title"><i className="fa-solid fa-lightbulb"></i> Format Tips</div>
            <ul>
              <li><strong>INV</strong> = Invoice — the most common prefix.</li>
              <li>Middle for year: <strong>INV-2026-001</strong> for easy filing.</li>
              <li>Middle for company: <strong>INV-COM-001</strong> (COM = 3-letter company code).</li>
              <li>Leave Middle blank for a simple <strong>INV-001</strong> format.</li>
            </ul>
          </div>
          <div className="confirm-actions modal-actions-sticky" style={{ flexDirection: 'row', marginTop: '6px' }}>
            <button className="btn btn-small btn-teal" onClick={applyNumberFormat}><i className="fa-solid fa-check"></i> Apply</button>
            <button className="btn btn-small btn-outline" onClick={() => setNumDialog(false)}>Cancel</button>
          </div>
        </div>
      </div>
      {payConflict && (
        <PaymentConflictDialog
          invoiceNumber={details.number}
          paidAmount={payConflict.paidSum}
          newStatus={details.status}
          currency={currency}
          onRemove={() => commitSave({ ...payConflict.invoiceObj, payments: [] })}
          onKeep={() => commitSave(payConflict.invoiceObj)}
          onCancel={() => setPayConflict(null)}
        />
      )}

      {/* Unsaved changes guard */}
      <div className={'confirm-overlay' + (pendingLeave ? ' show' : '')}>
        <div className="confirm-box">
          <div className="confirm-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
          <h3>Unsaved changes</h3>
          <p>You have unsaved changes on this invoice. What would you like to do?</p>
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