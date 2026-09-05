import { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { usePermissions } from '../hooks/usePermissions';
import { fmt, statusBadgeClass } from '../utils/format';
import QuoteDocument, { quoteToDocData } from './QuoteDocument';
import ScaleToFit from './ScaleToFit';
import PrintPortal from './PrintPortal';
import { exportElementToPDF, shareElementAsPDF, getElementPdfBase64 } from '../utils/pdf';
import { api } from '../utils/api';

export default function QuoteDetail({ quoteId, onBack, onEdit, onView }) {
  const { quotes, invoices, updateQuote, convertQuoteToInvoice, currentUser, invoiceTemplate, companySignature, currency } = useData();
  const { toast } = useToast();
  const { can } = usePermissions();
  const company = currentUser?.company || {};

  const q = quotes.find((x) => x.id === quoteId);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const previewRef = useRef(null);

  if (!q) {
    return (
      <div className="page active">
        <div className="back-link" onClick={onBack}><i className="fa-solid fa-arrow-left"></i> Back to Quotes</div>
        <div className="panel"><p className="empty-line">Quote not found.</p></div>
      </div>
    );
  }

  const status = q.status || 'Draft';
  const docData = quoteToDocData(q, company, companySignature);
  const convertedInvoice = q.convertedInvoiceId ? invoices.find((i) => (i._id || i.id) === q.convertedInvoiceId) : null;

  const markAs = (newStatus) => {
    updateQuote(q.id, { status: newStatus });
    toast('Status updated', `${q.number} marked as ${newStatus}.`);
  };

  const doConvert = async () => {
    setConverting(true);
    try {
      const created = await convertQuoteToInvoice(q.id);
      toast('Converted to invoice', `${created?.number || 'New invoice'} created as Draft.`);
    } catch (err) {
      toast('Could not convert', err.message || 'Please try again.', 'error');
    } finally {
      setConverting(false);
    }
  };

  const downloadPDF = () => {
    const el = previewRef.current?.querySelector('.inv-doc');
    if (el) { exportElementToPDF(el, q.number || 'quote'); toast('Download started', 'Your quote PDF is being generated.'); }
  };

  const shareQuote = async () => {
    const el = previewRef.current?.querySelector('.inv-doc');
    if (!el) return;
    try {
      const result = await shareElementAsPDF(el, q.number || 'quote', `Quote ${q.number} — ${fmt(q.total, currency)}`);
      if (result.method === 'native') toast('Shared', 'Quote PDF sent to the app you picked.');
      else if (result.method === 'download') toast('Downloaded', 'Sharing isn\'t supported here — attach the downloaded PDF manually.');
    } catch (err) {
      toast('Could not share quote', err.message || 'Please try again.', 'error');
    }
  };

  const emailQuote = async (recipientEmail) => {
    const el = previewRef.current?.querySelector('.inv-doc');
    if (!el) return;
    setEmailSending(true);
    try {
      const pdfBase64 = await getElementPdfBase64(el);
      await api.post(`/api/quotes/${q._id || q.id}/email`, { recipientEmail, pdfBase64 });
      toast('Quote emailed', `Sent to ${recipientEmail}.`);
      setEmailDialog(false);
    } catch (err) {
      toast('Could not send email', err.message || 'Please try again.', 'error');
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="page active">
      <div className="back-link" onClick={onBack}><i className="fa-solid fa-arrow-left"></i> Back to Quotes</div>

      <div className="detail-invoice-heading show-mobile">Quote {q.number}</div>

      <div className="invoice-detail-actions">
        {can('createInvoice') && status === 'Accepted' && (
          <button className="btn btn-small btn-teal detail-action-btn" onClick={doConvert} disabled={converting} title="Convert to Invoice">
            <i className="fa-solid fa-right-left"></i><span className="btn-label"> {converting ? 'Converting…' : 'Convert to Invoice'}</span>
          </button>
        )}
        {can('editInvoice') && status !== 'Converted' && <button className="btn btn-small btn-outline detail-action-btn" onClick={() => markAs('Accepted')} title="Mark Accepted"><i className="fa-solid fa-check"></i><span className="btn-label"> Mark Accepted</span></button>}
        {can('editInvoice') && status !== 'Converted' && <button className="btn btn-small btn-outline detail-action-btn" onClick={() => markAs('Rejected')} title="Mark Rejected"><i className="fa-solid fa-xmark"></i><span className="btn-label"> Mark Rejected</span></button>}
        {can('editInvoice') && status !== 'Converted' && <button className="btn btn-small btn-outline detail-action-btn" onClick={() => onEdit(q.id)} title="Edit"><i className="fa-solid fa-pen"></i><span className="btn-label"> Edit</span></button>}
        <button className="btn btn-small btn-outline detail-action-btn" onClick={downloadPDF} title="Download PDF"><i className="fa-solid fa-download"></i><span className="btn-label"> Download PDF</span></button>
        <button className="btn btn-small btn-outline detail-action-btn" onClick={shareQuote} title="Share Quote"><i className="fa-solid fa-share-nodes"></i><span className="btn-label"> Share Quote</span></button>
        <button className="btn btn-small btn-outline detail-action-btn" onClick={() => setEmailDialog(true)} title="Email PDF to Customer"><i className="fa-solid fa-envelope"></i><span className="btn-label"> Email PDF</span></button>
        <button className="btn btn-small btn-outline detail-action-btn" onClick={() => window.print()} title="Print"><i className="fa-solid fa-print"></i><span className="btn-label"> Print</span></button>
        <button className="btn btn-small btn-navy detail-preview-btn show-mobile" onClick={() => setMobilePreview(true)}><i className="fa-solid fa-eye"></i> Preview Quote</button>
      </div>

      <div className="invoice-detail-split">
        <div className="panel invoice-detail-list-panel hide-mobile">
          <h3>All Quotes</h3>
          <div className="invoice-detail-list">
            {quotes.slice().reverse().map((it) => (
              <div key={it.id} className={'invoice-detail-item' + (it.id === q.id ? ' active' : '')} onClick={() => onView(it.id)}>
                <div className="idi-top">
                  <span className="idi-number">{it.number}</span>
                  <span className={'status-badge ' + statusBadgeClass(it.status || 'Draft')}>{it.status || 'Draft'}</span>
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
          <div className="panel payment-summary-panel">
            <h3>Quote Summary</h3>
            <div className="pay-summary-row"><span>Customer</span><strong>{q.client}</strong></div>
            <div className="pay-summary-row"><span>Quote #</span><strong>{q.number}</strong></div>
            <div className="pay-summary-row"><span>Status</span><strong><span className={'status-badge ' + statusBadgeClass(status)}>{status}</span></strong></div>
            <div className="pay-summary-row"><span>Valid Until</span><strong>{q.validUntil || '—'}</strong></div>
            <div className="pay-summary-divider"></div>
            <div className="pay-summary-row"><span>Quote Total</span><strong>{fmt(q.total, currency)}</strong></div>
            {convertedInvoice && (
              <div className="pay-summary-row"><span>Converted To</span><strong style={{ color: 'var(--teal)' }}>Invoice {convertedInvoice.number}</strong></div>
            )}
          </div>

          <div className="panel invoice-view-detail-panel hide-mobile">
            <QuoteDocument data={docData} template={invoiceTemplate} currency={currency} />
          </div>
        </div>
      </div>

      <div ref={previewRef} style={{ position: 'absolute', left: '-10000px', top: 0, width: '794px', background: '#fff' }} aria-hidden="true">
        <QuoteDocument data={docData} template={invoiceTemplate} currency={currency} />
      </div>

      <PrintPortal>
        <QuoteDocument data={docData} template={invoiceTemplate} currency={currency} />
      </PrintPortal>

      {emailDialog && (
        <EmailPdfDialog
          defaultEmail={q.snapshot?.toEmail || ''}
          sending={emailSending}
          onSend={emailQuote}
          onClose={() => setEmailDialog(false)}
        />
      )}

      {mobilePreview && (
        <div className="mobile-preview-overlay show">
          <div className="mobile-preview-head">
            <span>Quote Preview</span>
            <button className="mobile-preview-close" onClick={() => setMobilePreview(false)}><i className="fa-solid fa-xmark"></i></button>
          </div>
          <div className="mobile-preview-body">
            <ScaleToFit>
              <QuoteDocument data={docData} template={invoiceTemplate} currency={currency} />
            </ScaleToFit>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailPdfDialog({ defaultEmail, sending, onSend, onClose }) {
  const [email, setEmail] = useState(defaultEmail);
  const [invalid, setInvalid] = useState(false);
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const send = () => {
    if (!validEmail(email.trim())) { setInvalid(true); return; }
    onSend(email.trim());
  };

  return (
    <div className="confirm-overlay show">
      <div className="confirm-box" style={{ maxWidth: '420px', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div className="confirm-icon" style={{ margin: 0, width: '44px', height: '44px', fontSize: '18px' }}><i className="fa-solid fa-envelope"></i></div>
          <h3 style={{ margin: 0 }}>Email Quote PDF</h3>
        </div>
        <p style={{ margin: '10px 0 16px' }}>The quote will be rendered as a PDF and emailed as an attachment.</p>
        <div className="field-sm"><label>Recipient Email</label>
          <input type="email" value={email} className={invalid ? 'invalid' : ''} onChange={(e) => { setEmail(e.target.value); setInvalid(false); }} placeholder="customer@email.com" />
        </div>
        <div className="confirm-actions" style={{ flexDirection: 'row', marginTop: '10px' }}>
          <button className="btn btn-small btn-teal" onClick={send} disabled={sending}>
            {sending ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Sending…</> : <><i className="fa-solid fa-paper-plane"></i> Send</>}
          </button>
          <button className="btn btn-small btn-outline" onClick={onClose} disabled={sending}>Cancel</button>
        </div>
      </div>
    </div>
  );
}