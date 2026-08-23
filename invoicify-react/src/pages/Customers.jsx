import { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { usePermissions } from '../hooks/usePermissions';
import { generateId } from '../utils/format';
import { statesForCountry } from '../utils/locationData';

const COUNTRIES = ['India', 'United States', 'United Kingdom', 'United Arab Emirates', 'Australia', 'Canada', 'Singapore', 'Germany', 'Other'];

const EMPTY_ADDR = { attention: '', country: 'India', street1: '', street2: '', city: '', state: '', pincode: '', phone: '' };
const EMPTY_FORM = {
  type: 'Business', company: '', gst: '', name: '', email: '', phone: '',
  billing: { ...EMPTY_ADDR }, shipping: { ...EMPTY_ADDR }
};

export default function Customers() {
  const { customers, addCustomer, updateCustomer, deleteCustomers } = useData();
  const { toast } = useToast();
  const { can } = usePermissions();

  const [view, setView] = useState('dashboard');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selected, setSelected] = useState(new Set());
  const [menuFor, setMenuFor] = useState(null);           // mobile card whose ⋮ menu is open
  const [pendingDelete, setPendingDelete] = useState(null); // customer awaiting delete confirm

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setAddr = (which, k) => (e) => setForm((p) => ({ ...p, [which]: { ...p[which], [k]: e.target.value } }));
  // Update several address fields at once (used when a parent field like
  // Country changes and its dependent State/District must be reset).
  const patchAddr = (which, patch) => setForm((p) => ({ ...p, [which]: { ...p[which], ...patch } }));

  const openNew = () => { setForm(EMPTY_FORM); setEditingId(null); setView('form'); };

  const openEdit = (c) => {
    setForm({
      type: c.type || 'Business', company: c.company || '', gst: c.gst || '', name: c.name || '',
      email: c.email || '', phone: c.phone || '',
      billing: { ...EMPTY_ADDR, ...(c.billing || {}) },
      shipping: { ...EMPTY_ADDR, ...(c.shipping || {}) }
    });
    setEditingId(c.id);
    setView('form');
  };

  const copyBillingToShipping = () => {
    setForm((p) => ({ ...p, shipping: { ...p.billing } }));
    toast('Copied', 'Billing address copied to shipping.');
  };

  const submit = () => {
    const isBiz = form.type === 'Business';
    if (form.name.trim().length < 1) { toast('Name required', isBiz ? 'Display Name is mandatory.' : 'Full Name is mandatory.', 'error'); return; }
    if (isBiz && !form.company.trim()) { toast('Company required', 'Business customers need a company name.', 'error'); return; }
    if (!form.billing.city.trim() || !form.billing.state.trim()) {
      toast('Address required', 'Billing City and State are mandatory.', 'error'); return;
    }
    const payload = {
      type: form.type,
      company: isBiz ? form.company.trim() : '',
      gst: isBiz ? (form.gst || '').trim() : '',
      name: form.name.trim(),
      email: form.email.trim(), phone: form.phone.trim(),
      billing: form.billing, shipping: form.shipping,
      address: [form.billing.city, form.billing.state].filter(Boolean).join(', ')
    };
    if (editingId) { updateCustomer(editingId, payload); toast('Customer updated', `${payload.name} saved.`); }
    else { addCustomer({ id: generateId('CUS'), ...payload }); toast('Customer added', `${payload.name} added.`); }
    setView('dashboard');
  };

  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleSelectAll = (checked) => setSelected(checked ? new Set(customers.map((c) => c.id)) : new Set());
  const bulkDelete = () => {
    deleteCustomers([...selected]);
    toast('Customers deleted', `${selected.size} removed.`, 'delete');
    setSelected(new Set());
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteCustomers([pendingDelete.id]);
    toast('Customer deleted', `${pendingDelete.name || 'Customer'} was removed.`, 'delete');
    setPendingDelete(null);
  };

  const count = customers.length;
  const businesses = customers.filter((c) => c.type === 'Business').length;

  return (
    <div className="page active">
      <div className="app-header-row">
        <div><h1 className="hide-mobile">Customers</h1><p className="hide-mobile">Save client details for faster invoicing.</p></div>
        {view === 'dashboard' && (
          <div className="header-actions">
            {selected.size === 1 && can('manageCustomers') && (
              <button className="btn btn-small btn-teal" onClick={() => { const c = customers.find((x) => x.id === [...selected][0]); if (c) openEdit(c); }}>
                <i className="fa-solid fa-pen"></i> Edit
              </button>
            )}
            {selected.size > 0 && can('manageCustomers') && (
              <button className="btn btn-small" style={{ background: 'var(--danger)', color: '#fff' }} onClick={bulkDelete}>
                <i className="fa-solid fa-trash-can"></i> Delete ({selected.size})
              </button>
            )}
            {can('manageCustomers') && (
              <button className="btn btn-small btn-orange hide-mobile" onClick={openNew}><i className="fa-solid fa-plus"></i> Add New Customer</button>
            )}
          </div>
        )}
      </div>

      {view === 'dashboard' ? (
        <>
          <div className="stat-grid hide-mobile" style={{ gridTemplateColumns: 'repeat(1,1fr)', maxWidth: '240px' }}>
            <div className="stat-card"><div className="stat-label">Total Customers</div><div className="stat-value">{count}</div></div>
          </div>

          <div className="panel">
            <h3>Saved Customers</h3>
            <div className="hide-mobile" style={{ overflowX: 'auto' }}>
              <table className="invoice-dash-table">
                <thead>
                  <tr>
                    <th style={{ width: '34px' }}><input type="checkbox" checked={count > 0 && selected.size === count} onChange={(e) => toggleSelectAll(e.target.checked)} /></th>
                    <th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {count === 0 ? (
                    <tr><td colSpan="6"><p className="empty-line" style={{ fontSize: '13px', margin: 0 }}>No customers yet — add your first client.</p></td></tr>
                  ) : customers.map((c) => (
                    <tr key={c.id} className="inv-row" onClick={() => openEdit(c)} style={{ cursor: 'pointer' }}>
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                      <td>{c.name}</td>
                      <td>{c.email || '—'}</td>
                      <td>{c.phone || '—'}</td>
                      <td>{c.address || '—'}</td>
                      <td>{c.type || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-invoice-cards show-mobile">
              {count === 0 ? (
                <p className="empty-line" style={{ fontSize: '13px' }}>No customers yet — tap + to add one.</p>
              ) : customers.map((c) => (
                <div className="mobile-inv-card" key={c.id} onClick={() => openEdit(c)}>
                  <div className="mic-left">
                    <div className="mic-customer">{c.name}</div>
                    <div className="mic-meta">
                      <span>{c.email || 'No email'}</span><br />
                      <span>{c.phone || 'No phone'}</span>
                    </div>
                  </div>
                  <div className="mic-right">
                    <span className="team-role-badge trb-staff" style={{ fontSize: '10px' }}>{c.type || 'Customer'}</span>
                  </div>

                  {can('manageCustomers') && (
                    <>
                      <button
                        className="mic-kebab"
                        aria-label="Customer actions"
                        onClick={(ev) => { ev.stopPropagation(); setMenuFor(menuFor === c.id ? null : c.id); }}
                      >
                        <i className="fa-solid fa-ellipsis-vertical"></i>
                      </button>

                      {menuFor === c.id && (
                        <div className="mic-menu" onClick={(ev) => ev.stopPropagation()}>
                          <button className="mic-menu-danger" onClick={() => { setMenuFor(null); setPendingDelete(c); }}>
                            <i className="fa-solid fa-trash-can"></i> Delete
                          </button>
                        </div>
                      )}
                    </>
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
                <h3>Delete this customer?</h3>
                <p>{pendingDelete.name ? `"${pendingDelete.name}"` : 'This customer'} will be permanently removed. This can't be undone.</p>
                <div className="confirm-actions">
                  <button className="btn btn-small" style={{ background: 'var(--danger)', color: '#fff' }} onClick={confirmDelete}>
                    <i className="fa-solid fa-trash-can"></i> Delete
                  </button>
                  <button className="btn btn-small btn-outline" onClick={() => setPendingDelete(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {can('manageCustomers') && (
            <button className="fab fab-customer" onClick={openNew} title="Add New Customer"><i className="fa-solid fa-plus"></i></button>
          )}
        </>
      ) : (
        <div className="subview active">
          <div className="back-link" onClick={() => setView('dashboard')}><i className="fa-solid fa-arrow-left"></i> Back to Customers</div>
          <div className="item-form-layout">
            <div className="panel">
              <h3>{editingId ? 'Edit Customer' : 'New Customer'}</h3>

              <div className="field-sm">
                <label>Customer Type</label>
                <div className="radio-row">
                  <label className="radio-pill"><input type="radio" name="cust-type" value="Business" checked={form.type === 'Business'} onChange={set('type')} /> Business</label>
                  <label className="radio-pill"><input type="radio" name="cust-type" value="Individual" checked={form.type === 'Individual'} onChange={set('type')} /> Individual</label>
                </div>
                <p className="field-note">{form.type === 'Business'
                  ? 'A company or organisation — invoiced under its business name.'
                  : 'A single person — invoiced directly, no company name needed.'}</p>
              </div>

              <div className="grid2">
                {form.type === 'Business' && (
                  <div className="field-sm"><label>Company Name <span className="req-star">*</span></label><input value={form.company} onChange={set('company')} placeholder="Company Pvt Ltd" /></div>
                )}
                <div className="field-sm"><label>{form.type === 'Business' ? 'Display Name' : 'Full Name'} <span className="req-star">*</span></label><input value={form.name} onChange={set('name')} placeholder={form.type === 'Business' ? 'How it appears on invoices' : 'e.g. Rajesh Kumar'} /></div>
                <div className="field-sm"><label>Email Address</label><input value={form.email} onChange={set('email')} placeholder="client@email.com" /></div>
                <div className="field-sm"><label>Phone Number</label><input value={form.phone} onChange={set('phone')} placeholder="+91 90000 00000" /></div>
                {form.type === 'Business' && (
                  <div className="field-sm"><label>GST / Tax ID</label><input value={form.gst} onChange={set('gst')} placeholder="e.g. 33ABCDE1234F1Z5" /></div>
                )}
              </div>

              <AddressSection title="Billing Address" which="billing" form={form} setAddr={setAddr} patchAddr={patchAddr} required />

              <div className="section-gap">
                <div className="cust-ship-header">
                  <h3 style={{ margin: 0 }}>Shipping Address</h3>
                  <button type="button" className="btn btn-small btn-outline" onClick={copyBillingToShipping}><i className="fa-solid fa-copy"></i> Same as Billing</button>
                </div>
                <AddressFields which="shipping" form={form} setAddr={setAddr} patchAddr={patchAddr} />
              </div>

              <div className="actions-row section-gap">
                <button className="btn btn-small btn-orange" onClick={submit}><i className={'fa-solid ' + (editingId ? 'fa-floppy-disk' : 'fa-plus')}></i> {editingId ? 'Save Customer' : 'Add Customer'}</button>
                <button className="btn btn-small btn-outline" onClick={() => setView('dashboard')}><i className="fa-solid fa-xmark"></i> Cancel</button>
              </div>
            </div>

            <div className="item-form-side">
              <div className="panel">
                <h3>Customers Overview</h3>
                <div className="mini-stat-row">
                  <div className="mini-stat"><div className="mini-stat-label">Total Customers</div><div className="mini-stat-value">{count}</div></div>
                  <div className="mini-stat"><div className="mini-stat-label">Businesses</div><div className="mini-stat-value">{businesses}</div></div>
                </div>
                <div className="tips-box">
                  <div className="tips-title"><i className="fa-solid fa-lightbulb"></i> Quick Tips</div>
                  <ul>
                    <li><strong>Display Name</strong> is what appears on the invoice.</li>
                    <li>Use <strong>Same as Billing</strong> to copy the address in one click.</li>
                    <li>Saved customers can be applied to invoices instantly.</li>
                  </ul>
                </div>
              </div>

              <div className="panel section-gap">
                <h3>Recently Added</h3>
                <div className="saved-list">
                  {count === 0
                    ? <p className="empty-line" style={{ fontSize: '13px' }}>No customers yet.</p>
                    : customers.slice().reverse().slice(0, 5).map((c) => (
                      <div className="saved-item" key={c.id}>
                        <div><strong>{c.name}</strong>{c.email || c.phone || '—'}</div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddressSection({ title, which, form, setAddr, patchAddr, required }) {
  return (
    <div className="section-gap">
      <h3>{title}</h3>
      <AddressFields which={which} form={form} setAddr={setAddr} patchAddr={patchAddr} required={required} />
    </div>
  );
}

function AddressFields({ which, form, setAddr, patchAddr, required }) {
  const a = form[which];
  const req = required ? <span className="req-star">*</span> : null;

  const states = statesForCountry(a.country); // strict list for India etc., or [] => free text

  // Pincode -> State/District auto-fill (India only, via the free India Post API).
  // status: idle | checking | found | notfound | error
  const [pinStatus, setPinStatus] = useState('idle');
  const lastLookup = useRef('');

  const onCountry = (e) => { setPinStatus('idle'); patchAddr(which, { country: e.target.value, state: '', city: '' }); };

  const onPincode = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    setAddr(which, 'pincode')({ target: { value } });
  };

  useEffect(() => {
    const pin = (a.pincode || '').trim();
    if (a.country !== 'India' || pin.length !== 6) { setPinStatus('idle'); return undefined; }
    if (lastLookup.current === pin) return undefined; // already handled this pin

    setPinStatus('checking');
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: controller.signal });
        const data = await res.json();
        const entry = Array.isArray(data) ? data[0] : null;
        const po = entry && entry.Status === 'Success' && entry.PostOffice && entry.PostOffice[0];
        if (!po) { setPinStatus('notfound'); return; }
        lastLookup.current = pin;
        patchAddr(which, { state: po.State || a.state, city: po.District || a.city });
        setPinStatus('found');
      } catch (err) {
        if (err.name !== 'AbortError') setPinStatus('error');
      }
    }, 450);
    return () => { controller.abort(); clearTimeout(t); };
  }, [a.pincode, a.country]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid2">
      <div className="field-sm"><label>Attention</label><input value={a.attention} onChange={setAddr(which, 'attention')} placeholder="Contact person" /></div>
      <div className="field-sm"><label>Country / Region</label>
        <select value={a.country} onChange={onCountry}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="field-sm"><label>Street 1</label><input value={a.street1} onChange={setAddr(which, 'street1')} placeholder="Street address line 1" /></div>
      <div className="field-sm"><label>Street 2</label><input value={a.street2} onChange={setAddr(which, 'street2')} placeholder="Street address line 2" /></div>

      <div className="field-sm"><label>Pin Code</label>
        <input value={a.pincode} onChange={onPincode} placeholder="600001" inputMode="numeric" />
        {a.country === 'India' && pinStatus === 'checking' && <div className="pin-hint pin-checking"><i className="fa-solid fa-circle-notch fa-spin"></i> Looking up…</div>}
        {a.country === 'India' && pinStatus === 'found' && <div className="pin-hint pin-ok"><i className="fa-solid fa-circle-check"></i> State &amp; district filled</div>}
        {a.country === 'India' && pinStatus === 'notfound' && <div className="pin-hint pin-bad"><i className="fa-solid fa-circle-info"></i> Pincode not found — enter manually</div>}
        {a.country === 'India' && pinStatus === 'error' && <div className="pin-hint pin-bad"><i className="fa-solid fa-circle-info"></i> Couldn't look up — enter manually</div>}
      </div>

      <div className="field-sm"><label>State {req}</label>
        {states.length > 0 ? (
          <select value={a.state} onChange={setAddr(which, 'state')}>
            <option value="">Select state…</option>
            {states.map((st) => <option key={st} value={st}>{st}</option>)}
            {a.state && !states.includes(a.state) && <option value={a.state}>{a.state}</option>}
          </select>
        ) : (
          <input value={a.state} onChange={setAddr(which, 'state')} placeholder="State / Province" />
        )}
      </div>

      <div className="field-sm"><label>City / District {req}</label>
        <input value={a.city} onChange={setAddr(which, 'city')} placeholder="City / District" />
      </div>

      <div className="field-sm"><label>Phone</label><input value={a.phone} onChange={setAddr(which, 'phone')} placeholder="+91 90000 00000" /></div>
    </div>
  );
}
