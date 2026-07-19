import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { usePermissions } from '../hooks/usePermissions';
import { generateId } from '../utils/format';

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

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setAddr = (which, k) => (e) => setForm((p) => ({ ...p, [which]: { ...p[which], [k]: e.target.value } }));

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

  const count = customers.length;
  const businesses = customers.filter((c) => c.type === 'Business').length;

  return (
    <div className="page active">
      <div className="app-header-row">
        <div><h1>Customers</h1><p className="hide-mobile">Save client details for faster invoicing.</p></div>
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
                </div>
              ))}
            </div>
          </div>

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

              <AddressSection title="Billing Address" which="billing" form={form} setAddr={setAddr} required />

              <div className="section-gap">
                <div className="cust-ship-header">
                  <h3 style={{ margin: 0 }}>Shipping Address</h3>
                  <button type="button" className="btn btn-small btn-outline" onClick={copyBillingToShipping}><i className="fa-solid fa-copy"></i> Same as Billing</button>
                </div>
                <AddressFields which="shipping" form={form} setAddr={setAddr} />
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

function AddressSection({ title, which, form, setAddr, required }) {
  return (
    <div className="section-gap">
      <h3>{title}</h3>
      <AddressFields which={which} form={form} setAddr={setAddr} required={required} />
    </div>
  );
}

function AddressFields({ which, form, setAddr, required }) {
  const a = form[which];
  const req = required ? <span className="req-star">*</span> : null;
  return (
    <div className="grid2">
      <div className="field-sm"><label>Attention</label><input value={a.attention} onChange={setAddr(which, 'attention')} placeholder="Contact person" /></div>
      <div className="field-sm"><label>Country / Region</label>
        <select value={a.country} onChange={setAddr(which, 'country')}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="field-sm"><label>Street 1</label><input value={a.street1} onChange={setAddr(which, 'street1')} placeholder="Street address line 1" /></div>
      <div className="field-sm"><label>Street 2</label><input value={a.street2} onChange={setAddr(which, 'street2')} placeholder="Street address line 2" /></div>
      <div className="field-sm"><label>City {req}</label><input value={a.city} onChange={setAddr(which, 'city')} placeholder="City" /></div>
      <div className="field-sm"><label>State {req}</label><input value={a.state} onChange={setAddr(which, 'state')} placeholder="State" /></div>
      <div className="field-sm"><label>Pin Code</label><input value={a.pincode} onChange={(e) => setAddr(which, 'pincode')({ target: { value: e.target.value.replace(/[^0-9]/g, '') } })} placeholder="600001" inputMode="numeric" /></div>
      <div className="field-sm"><label>Phone</label><input value={a.phone} onChange={setAddr(which, 'phone')} placeholder="+91 90000 00000" /></div>
    </div>
  );
}
