import { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { usePermissions } from '../hooks/usePermissions';
import { fmt, statusBadgeClass } from '../utils/format';
import InvoiceDocument, { invoiceToDocData } from './InvoiceDocument';
import ScaleToFit from './ScaleToFit';
import PrintPortal from './PrintPortal';
import { exportElementToPDF, shareElementAsPDF } from '../utils/pdf';

function paidTotal(inv) {
  return (inv.payments || []).reduce((s, p) => s + p.amount, 0);
}

export default function InvoiceDetail({ invoiceId, onBack, onEdit, onView }) {
  const { invoices, updateInvoice, currentUser, invoiceTemplate, companySignature, currency } = useData();
  const { toast } = useToast();
  const { can } = usePermissions();
  const company = currentUser?.company || {};

  const inv = invoices.find((i) => i.id === invoiceId);
  const [payDialog, setPayDialog] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const previewRef = useRef(null);

  if (!inv) {
    return (
      <div className="page active">
        <div className="back-link" onClick={onBack}><i className="fa-solid fa-arrow-left"></i> Back to Invoices</div>
        <div className="panel"><p className="empty-line">Invoice not found.</p></div>
      </div>
    );
  }

  const status = inv.status || 'Draft';
  const [removePayConfirm, setRemovePayConfirm] = useState(false);
  const paid = paidTotal(inv);
  const balance = Math.max(0, inv.total - paid);
  const pct = inv.total > 0 ? Math.min(100, (paid / inv.total) * 100) : 0;
  const docData = invoiceToDocData(inv, company, companySignature);

  // Status and payments are independent now — "Mark as Sent" only ever
  // changes the status label, it never touches recorded payments. To
  // remove a payment, use the dedicated "Remove Payment" button (or the
  // per-entry delete in Payment History) instead.
  const markAs = (newStatus) => {
    updateInvoice(inv.id, { status: newStatus });
    toast('Status updated', `${inv.number} marked as ${newStatus}.`);
  };

  const removeAllPayments = () => {
    const newStatus = inv.status === 'Paid' ? 'Sent' : inv.status;
    updateInvoice(inv.id, { status: newStatus, payments: [] });
    setRemovePayConfirm(false);
    toast('Payment removed', 'Income updated.', 'delete');
  };

  const recordPayment = (payment) => {
    const payments = [...(inv.payments || []), payment];
    const newPaid = payments.reduce((s, p) => s + p.amount, 0);
    let newStatus = inv.status;
    if (newPaid >= inv.total) newStatus = 'Paid';
    else if (inv.status === 'Draft' || inv.status === 'Unpaid') newStatus = 'Sent';
    updateInvoice(inv.id, { payments, status: newStatus });
    setPayDialog(false);
    const bal = Math.max(0, inv.total - newPaid);
    toast('Payment recorded', bal > 0 ? `${fmt(bal, currency)} balance remaining.` : 'Invoice fully paid!');
  };

  const deletePayment = (idx) => {
    const payments = (inv.payments || []).filter((_, i) => i !== idx);
    const newPaid = payments.reduce((s, p) => s + p.amount, 0);
    let newStatus = inv.status;
    if (newPaid >= inv.total && inv.total > 0) newStatus = 'Paid';
    else if (inv.status === 'Paid') newStatus = 'Sent';
    updateInvoice(inv.id, { payments, status: newStatus });
    toast('Payment removed', 'The payment entry was deleted.', 'delete');
  };

  const downloadPDF = () => {
    const el = previewRef.current?.querySelector('.inv-doc');
    if (el) { exportElementToPDF(el, inv.number || 'invoice'); toast('Download started', 'Your invoice PDF is being generated.'); }
  };

  const shareInvoice = async () => {
    const el = previewRef.current?.querySelector('.inv-doc');
    if (!el) return;
    try {
      const result = await shareElementAsPDF(
        el,
        inv.number || 'invoice',
        `Invoice ${inv.number} — ${fmt(inv.total, currency)}`
      );
      if (result.method === 'native') toast('Shared', 'Invoice PDF sent to the app you picked.');
      else if (result.method === 'download') toast('Downloaded', 'Sharing isn\'t supported here — attach the downloaded PDF manually.');
      // 'cancelled' — the person just backed out of the share sheet, no toast needed.
    } catch (err) {
      toast('Could not share invoice', err.message || 'Please try again.', 'error');
    }
  };

  return (
    <div className="page active">
      <div className="back-link" onClick={onBack}><i className="fa-solid fa-arrow-left"></i> Back to Invoices</div>

      <div className="detail-invoice-heading show-mobile">Invoice {inv.number}</div>

      <div className="invoice-detail-actions">
        {can('recordPayment') && <button className="btn btn-small btn-teal detail-action-btn" onClick={() => setPayDialog(true)} title="Record Payment"><i className="fa-solid fa-indian-rupee-sign"></i><span className="btn-label"> Record Payment</span></button>}
        {can('recordPayment') && paid > 0 && <button className="btn btn-small btn-outline detail-action-btn" onClick={() => setRemovePayConfirm(true)} title="Undo Payment"><i className="fa-solid fa-rupee-sign"></i><span className="btn-label"> Undo Payment</span></button>}
        {can('recordPayment') && <button className="btn btn-small btn-outline detail-action-btn" onClick={() => markAs('Sent')} title="Mark as Sent"><i className="fa-solid fa-paper-plane"></i><span className="btn-label"> Mark as Sent</span></button>}
        {can('editInvoice') && <button className="btn btn-small btn-outline detail-action-btn" onClick={() => onEdit(inv.id)} title="Edit"><i className="fa-solid fa-pen"></i><span className="btn-label"> Edit</span></button>}
        <button className="btn btn-small btn-outline detail-action-btn" onClick={downloadPDF} title="Download PDF"><i className="fa-solid fa-download"></i><span className="btn-label"> Download PDF</span></button>
        <button className="btn btn-small btn-outline detail-action-btn" onClick={shareInvoice} title="Share Invoice"><i className="fa-solid fa-share-nodes"></i><span className="btn-label"> Share Invoice</span></button>
        <button className="btn btn-small btn-outline detail-action-btn" onClick={() => window.print()} title="Print"><i className="fa-solid fa-print"></i><span className="btn-label"> Print</span></button>
        <button className="btn btn-small btn-navy detail-preview-btn show-mobile" onClick={() => setMobilePreview(true)}><i className="fa-solid fa-eye"></i> Preview Invoice</button>
      </div>

      <div className="invoice-detail-split">
        {/* All invoices list (desktop) */}
        <div className="panel invoice-detail-list-panel hide-mobile">
          <h3>All Invoices</h3>
          <div className="invoice-detail-list">
            {invoices.slice().reverse().map((it) => (
              <div key={it.id} className={'invoice-detail-item' + (it.id === inv.id ? ' active' : '')} onClick={() => onView(it.id)}>
                <div className="idi-top">
                  <span className="idi-number">{it.number}</span>
                  <span className={'status-badge ' + statusBadgeClass(it.status || 'Unpaid')}>{it.status || 'Unpaid'}</span>
                </div>
                <div className="idi-client">{it.client}</div>
                <div className="idi-bottom">
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{it.date || '—'}</span>
                  <span className="idi-amount">{fmt(it.total, currency)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="invoice-detail-right">
          {/* Payment summary */}
          <div className="panel payment-summary-panel">
            <h3>Payment Summary</h3>
            <div className="pay-summary-row"><span>Customer</span><strong>{inv.client}</strong></div>
            <div className="pay-summary-row"><span>Invoice #</span><strong>{inv.number}</strong></div>
            <div className="pay-summary-row"><span>Status</span><strong><span className={'status-badge ' + statusBadgeClass(status)}>{status}</span></strong></div>
            <div className="pay-summary-row"><span>Due Date</span><strong>{inv.dueDate || '—'}</strong></div>
            <div className="pay-summary-divider"></div>
            <div className="pay-summary-row"><span>Invoice Total</span><strong>{fmt(inv.total, currency)}</strong></div>
            <div className="pay-summary-row"><span>Amount Paid</span><strong style={{ color: 'var(--teal)' }}>{fmt(paid, currency)}</strong></div>
            <div className="pay-summary-row pay-balance-row"><span>Balance Due</span><strong style={{ color: 'var(--orange)' }}>{fmt(balance, currency)}</strong></div>
            <div className="pay-progress-track"><div className="pay-progress-fill" style={{ width: pct + '%' }}></div></div>
            <div className="pay-progress-label">{balance <= 0 && inv.total > 0 ? '✓ Fully paid' : Math.round(pct) + '% paid'}</div>
            <div className="pay-history-title">Payment History</div>
            <div className="pay-history-list">
              {(!inv.payments || inv.payments.length === 0)
                ? <p className="empty-line" style={{ fontSize: '12.5px' }}>No payments recorded yet.</p>
                : inv.payments.map((p, idx) => (
                  <div className="pay-history-item" key={idx}>
                    <div>
                      <div className="pay-history-amount">{fmt(p.amount, currency)}</div>
                      <div className="pay-history-meta">{p.date} · {p.method}</div>
                    </div>
                    {can('recordPayment') && <button className="pay-history-del" title="Remove" onClick={() => deletePayment(idx)}><i className="fa-solid fa-trash-can"></i></button>}
                  </div>
                ))}
            </div>
          </div>

          {/* Preview (desktop) */}
          <div className="panel invoice-view-detail-panel hide-mobile">
            <InvoiceDocument data={docData} template={invoiceTemplate} currency={currency} />
          </div>
        </div>
      </div>

      {/* Off-screen preview used for reliable PDF export on any screen size */}
      <div ref={previewRef} style={{ position: 'absolute', left: '-10000px', top: 0, width: '794px', background: '#fff' }} aria-hidden="true">
        <InvoiceDocument data={docData} template={invoiceTemplate} currency={currency} />
      </div>

      {/* Print copy — lives outside the app tree so printing can hide #root
          entirely and avoid the blank leading pages the old approach produced. */}
      <PrintPortal>
        <InvoiceDocument data={docData} template={invoiceTemplate} currency={currency} />
      </PrintPortal>

      {/* Remove payment confirmation */}
      {removePayConfirm && (
        <div className="confirm-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setRemovePayConfirm(false); }}>
          <div className="confirm-box">
            <div className="confirm-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
            <h3>Remove this payment?</h3>
            <p>{fmt(paid, currency)} recorded on {inv.number} will be removed. Income reports will update to reflect this. This can't be undone.</p>
            <div className="confirm-actions">
              <button className="btn btn-small" style={{ background: 'var(--danger)', color: '#fff' }} onClick={removeAllPayments}>
                <i className="fa-solid fa-trash-can"></i> Remove Payment
              </button>
              <button className="btn btn-small btn-outline" onClick={() => setRemovePayConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment dialog */}
      {payDialog && <PaymentDialog balance={balance} currency={currency} onSave={recordPayment} onClose={() => setPayDialog(false)} />}

      {/* Mobile full-screen preview */}
      {mobilePreview && (
        <div className="mobile-preview-overlay show">
          <div className="mobile-preview-head">
            <span>Invoice Preview</span>
            <button className="mobile-preview-close" onClick={() => setMobilePreview(false)}><i className="fa-solid fa-xmark"></i></button>
          </div>
          <div className="mobile-preview-body">
            <ScaleToFit>
              <InvoiceDocument data={docData} template={invoiceTemplate} currency={currency} />
            </ScaleToFit>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentDialog({ balance, currency, onSave, onClose }) {
  const [amount, setAmount] = useState(balance > 0 ? balance.toFixed(2) : '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('Cash');
  const [invalid, setInvalid] = useState(false);

  const save = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setInvalid(true); return; }
    onSave({ amount: amt, date: date || new Date().toISOString().slice(0, 10), method });
  };

  return (
    <div className="confirm-overlay show">
      <div className="confirm-box" style={{ maxWidth: '420px', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div className="confirm-icon" style={{ margin: 0, width: '44px', height: '44px', fontSize: '18px' }}><i className="fa-solid fa-indian-rupee-sign"></i></div>
          <h3 style={{ margin: 0 }}>Record Payment</h3>
        </div>
        <p style={{ margin: '10px 0 16px' }}>Add a payment received for this invoice. Balance updates automatically.</p>
        <div className="pay-dialog-balance">Balance Due: <strong>{fmt(balance, currency)}</strong></div>
        <div className="field-sm"><label>Amount Received</label>
          <input type="number" min="0" step="0.01" value={amount} className={invalid ? 'invalid' : ''} onChange={(e) => { setAmount(e.target.value); setInvalid(false); }} placeholder="0.00" />
        </div>
        <div className="grid2">
          <div className="field-sm"><label>Payment Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field-sm"><label>Payment Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank Account">Bank Account</option>
            </select>
          </div>
        </div>
        <div className="confirm-actions" style={{ flexDirection: 'row', marginTop: '10px' }}>
          <button className="btn btn-small btn-teal" onClick={save}><i className="fa-solid fa-check"></i> Save Payment</button>
          <button className="btn btn-small btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}