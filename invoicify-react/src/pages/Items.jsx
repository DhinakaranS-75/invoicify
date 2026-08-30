import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { usePermissions } from '../hooks/usePermissions';
import { fmt, generateId } from '../utils/format';

const EMPTY_FORM = {
  name: '', type: 'Goods', sku: '', category: 'General',
  description: '', hsn: '', price: '', selling: '', tax: '', unit: 'Box'
};

export default function Items() {
  const { catalogItems, addItem, updateItem, deleteItems, currency } = useData();
  const { toast } = useToast();
  const { can } = usePermissions();

  const [view, setView] = useState('dashboard'); // dashboard | form
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selected, setSelected] = useState(new Set());
  const [menuFor, setMenuFor] = useState(null);           // mobile card whose ⋮ menu is open
  const [pendingDelete, setPendingDelete] = useState(null); // item awaiting delete confirm

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const totalValue = catalogItems.reduce((s, i) => s + (i.sellingPrice ?? i.price ?? 0), 0);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setView('form');
  };

  const openEdit = (item) => {
    setForm({
      name: item.name || '', type: item.type || 'Goods', sku: item.sku || '',
      category: item.category || 'General', description: item.description || '', hsn: item.hsn || '',
      price: item.price ?? '', selling: item.sellingPrice ?? '', tax: item.tax ?? '', unit: item.unit || 'Box'
    });
    setEditingId(item.id);
    setView('form');
  };

  const submit = () => {
    if (form.name.trim().length < 1) { toast('Name required', 'Please enter a product name.', 'error'); return; }
    const payload = {
      name: form.name.trim(), type: form.type, sku: form.sku.trim(), category: form.category,
      description: form.description.trim(), hsn: form.hsn.trim(),
      price: parseFloat(form.price) || 0,
      sellingPrice: parseFloat(form.selling) || 0,
      tax: parseFloat(form.tax) || 0,
      unit: form.unit
    };
    if (editingId) {
      updateItem(editingId, payload);
      toast('Item updated', `${payload.name} was saved.`);
    } else {
      addItem({ id: generateId('ITM'), ...payload });
      toast('Item added', `${payload.name} added to catalog.`);
    }
    setView('dashboard');
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (checked) => {
    setSelected(checked ? new Set(catalogItems.map((i) => i.id)) : new Set());
  };

  const bulkDelete = () => {
    deleteItems([...selected]);
    toast('Items deleted', `${selected.size} item(s) removed.`, 'delete');
    setSelected(new Set());
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteItems([pendingDelete.id]);
    toast('Item deleted', `${pendingDelete.name || 'Item'} was removed.`, 'delete');
    setPendingDelete(null);
  };

  // Side panel stats
  const count = catalogItems.length;
  const avg = count ? totalValue / count : 0;
  const categories = new Set(catalogItems.map((i) => i.category).filter(Boolean)).size;

  return (
    <div className="page active">
      <div className="app-header-row">
        <div><h1 className="hide-mobile">Items</h1><p className="hide-mobile">Manage your product/service catalog for faster invoicing.</p></div>
        {view === 'dashboard' && (
          <div className="header-actions">
            {selected.size === 1 && can('manageItems') && (
              <button className="btn btn-small btn-teal" onClick={() => { const it = catalogItems.find((x) => x.id === [...selected][0]); if (it) openEdit(it); }}>
                <i className="fa-solid fa-pen"></i> Edit
              </button>
            )}
            {selected.size > 0 && can('manageItems') && (
              <button className="btn btn-small" style={{ background: 'var(--danger)', color: '#fff' }} onClick={bulkDelete}>
                <i className="fa-solid fa-trash-can"></i> Delete ({selected.size})
              </button>
            )}
            {can('manageItems') && (
              <button className="btn btn-small btn-orange hide-mobile" onClick={openNew}><i className="fa-solid fa-plus"></i> Add New Item</button>
            )}
          </div>
        )}
      </div>

      {view === 'dashboard' ? (
        <>
          <div className="stat-grid hide-mobile" style={{ gridTemplateColumns: 'repeat(2,1fr)', maxWidth: '480px' }}>
            <div className="stat-card"><div className="stat-label">Total Items</div><div className="stat-value">{count}</div></div>
            <div className="stat-card"><div className="stat-label">Catalog Value</div><div className="stat-value">{fmt(totalValue, currency)}</div></div>
          </div>

          <div className="panel">
            <h3>Item Catalog</h3>
            <div className="hide-mobile" style={{ overflowX: 'auto' }}>
              <table className="invoice-dash-table">
                <thead>
                  <tr>
                    <th style={{ width: '34px' }}><input type="checkbox" checked={count > 0 && selected.size === count} onChange={(e) => toggleSelectAll(e.target.checked)} /></th>
                    <th>Item Name</th><th>SKU</th><th>HSN/SAC</th><th>Category</th><th>Description</th>
                    <th>Purchase Rate</th><th>Selling Price</th><th>Tax %</th><th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {count === 0 ? (
                    <tr><td colSpan="10"><p className="empty-line" style={{ fontSize: '13px', margin: 0 }}>No items yet — add your first product or service.</p></td></tr>
                  ) : catalogItems.map((it) => (
                    <tr key={it.id} className="inv-row" onClick={() => openEdit(it)} style={{ cursor: 'pointer' }}>
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleSelect(it.id)} /></td>
                      <td>{it.name}</td>
                      <td>{it.sku || '—'}</td>
                      <td>{it.hsn || '—'}</td>
                      <td>{it.category || '—'}</td>
                      <td>{it.description || '—'}</td>
                      <td className="amt-col">{fmt(it.price || 0, currency)}</td>
                      <td className="amt-col">{fmt(it.sellingPrice || 0, currency)}</td>
                      <td>{it.tax ? it.tax + '%' : '—'}</td>
                      <td>{it.unit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mobile-invoice-cards show-mobile">
              {count === 0 ? (
                <p className="empty-line" style={{ fontSize: '13px' }}>No items yet — tap + to add one.</p>
              ) : catalogItems.map((it) => (
                <div className="mobile-inv-card" key={it.id} onClick={() => openEdit(it)}>
                  <div className="mic-left">
                    <div className="mic-customer">{it.name}</div>
                    <div className="mic-meta">
                      <span>{it.sku ? 'SKU: ' + it.sku : 'No SKU'}</span><br />
                      <span>{it.category || 'Uncategorized'}</span>
                    </div>
                  </div>
                  <div className="mic-right">
                    <span className="mic-amount">{fmt(it.sellingPrice || it.price || 0, currency)}</span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{it.unit || ''}</span>
                  </div>

                  {can('manageItems') && (
                    <>
                      <button
                        className="mic-kebab"
                        aria-label="Item actions"
                        onClick={(ev) => { ev.stopPropagation(); setMenuFor(menuFor === it.id ? null : it.id); }}
                      >
                        <i className="fa-solid fa-ellipsis-vertical"></i>
                      </button>

                      {menuFor === it.id && (
                        <div className="mic-menu" onClick={(ev) => ev.stopPropagation()}>
                          <button className="mic-menu-danger" onClick={() => { setMenuFor(null); setPendingDelete(it); }}>
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
                <h3>Delete this item?</h3>
                <p>{pendingDelete.name ? `"${pendingDelete.name}"` : 'This item'} will be permanently removed. This can't be undone.</p>
                <div className="confirm-actions">
                  <button className="btn btn-small" style={{ background: 'var(--danger)', color: '#fff' }} onClick={confirmDelete}>
                    <i className="fa-solid fa-trash-can"></i> Delete
                  </button>
                  <button className="btn btn-small btn-outline" onClick={() => setPendingDelete(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {can('manageItems') && (
            <button className="fab fab-item" onClick={openNew} title="Add New Item"><i className="fa-solid fa-plus"></i></button>
          )}
        </>
      ) : (
        <div className="subview active">
          <div className="back-link" onClick={() => setView('dashboard')}><i className="fa-solid fa-arrow-left"></i> Back to Items</div>
          <div className="item-form-layout">
            <div className="panel">
              <h3>{editingId ? 'Edit Item' : 'New Item'}</h3>
              <div className="grid2">
                <div className="field-sm"><label>Product Name</label><input value={form.name} onChange={set('name')} placeholder="Product Name" /></div>
                <div className="field-sm"><label>Product Type</label>
                  <select value={form.type} onChange={set('type')}><option value="Goods">Goods</option><option value="Service">Service</option></select>
                </div>
                <div className="field-sm"><label>SKU / Item Code</label><input value={form.sku} onChange={set('sku')} placeholder="e.g. PRD-001" /></div>
                <div className="field-sm"><label>Category</label>
                  <select value={form.category} onChange={set('category')}>
                    <option>General</option><option>Electronics</option><option>Office Supplies</option><option>Services</option>
                    <option>Software</option><option>Hardware</option><option>Furniture</option><option>Other</option>
                  </select>
                </div>
                <div className="field-sm">
                  <label>{form.type === 'Service' ? 'SAC Code' : 'HSN Code'} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input value={form.hsn} onChange={set('hsn')} placeholder={form.type === 'Service' ? 'e.g. 998314' : 'e.g. 8471'} />
                </div>
              </div>
              <div className="field-sm"><label>Item Description</label><textarea value={form.description} onChange={set('description')} placeholder="Brief description of this item or service"></textarea></div>
              <div className="grid2">
                <div className="field-sm"><label>Purchase Rate</label><input type="number" min="0" step="0.01" value={form.price} onChange={set('price')} placeholder="0.00" /></div>
                <div className="field-sm"><label>Selling Price</label><input type="number" min="0" step="0.01" value={form.selling} onChange={set('selling')} placeholder="0.00" /></div>
                <div className="field-sm"><label>Tax Rate (%)</label><input type="number" min="0" max="100" step="0.01" value={form.tax} onChange={set('tax')} placeholder="e.g. 18" /></div>
                <div className="field-sm"><label>Usage Unit</label>
                  <select value={form.unit} onChange={set('unit')}><option value="Box">Box</option><option value="Pcs">Pcs</option><option value="Number">Number</option></select>
                </div>
              </div>
              <div className="actions-row">
                <button className="btn btn-small btn-orange" onClick={submit}><i className={'fa-solid ' + (editingId ? 'fa-floppy-disk' : 'fa-plus')}></i> {editingId ? 'Save Item' : 'Add Item'}</button>
                <button className="btn btn-small btn-outline" onClick={() => setView('dashboard')}><i className="fa-solid fa-xmark"></i> Cancel</button>
              </div>
            </div>

            <div className="item-form-side">
              <div className="panel">
                <h3>Catalog Overview</h3>
                <div className="mini-stat-row">
                  <div className="mini-stat"><div className="mini-stat-label">Total Items</div><div className="mini-stat-value">{count}</div></div>
                  <div className="mini-stat"><div className="mini-stat-label">Catalog Value</div><div className="mini-stat-value">{fmt(totalValue, currency)}</div></div>
                </div>
                <div className="mini-stat-row">
                  <div className="mini-stat"><div className="mini-stat-label">Avg. Price</div><div className="mini-stat-value">{fmt(avg, currency)}</div></div>
                  <div className="mini-stat"><div className="mini-stat-label">Categories</div><div className="mini-stat-value">{categories}</div></div>
                </div>
                <div className="tips-box">
                  <div className="tips-title"><i className="fa-solid fa-lightbulb"></i> Quick Tips</div>
                  <ul>
                    <li>Use <strong>SKU codes</strong> like PRD-001 to find items fast.</li>
                    <li><strong>Selling Price</strong> fills the invoice rate automatically.</li>
                    <li>Set <strong>Tax Rate</strong> per item to apply GST on invoices.</li>
                  </ul>
                </div>
              </div>

              <div className="panel section-gap">
                <h3>Recently Added</h3>
                <div className="saved-list">
                  {count === 0
                    ? <p className="empty-line" style={{ fontSize: '13px' }}>No items yet.</p>
                    : catalogItems.slice().reverse().slice(0, 5).map((it) => (
                      <div className="saved-item" key={it.id}>
                        <div><strong>{it.name}</strong>{it.category || '—'}</div>
                        <div className="amt-col">{fmt(it.sellingPrice || it.price || 0, currency)}</div>
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