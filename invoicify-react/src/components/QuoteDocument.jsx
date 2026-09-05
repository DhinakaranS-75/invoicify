import { fmt, numberToWords } from '../utils/format';

const STAMP_CLASS = {
  Accepted: 'stamp-accepted', Rejected: 'stamp-rejected', Expired: 'stamp-expired',
  Converted: 'stamp-converted', Sent: 'stamp-sent', Draft: 'stamp-draft'
};

/**
 * Renders the quote/estimate document. Deliberately reuses the exact same
 * `.inv-doc*` class names as InvoiceDocument so all 9 existing CSS template
 * variants apply automatically — no new template CSS needed. Only the
 * labels differ (QUOTE vs INVOICE, Valid Until vs Due Date), and there's no
 * bank/UPI/payment section since a quote is nothing to pay yet.
 */
export default function QuoteDocument({ data, template = 'classic', currency = 'INR' }) {
  const status = data.status || 'Draft';
  const stampClass = STAMP_CLASS[status] || 'stamp-draft';
  const amountWords = numberToWords(data.total);
  const contactLine = [data.fromEmail, data.fromPhone].filter(Boolean).join(' / ') || '\u2014';

  return (
    <div className={`inv-doc inv-doc-${template || 'classic'}`}>
      <div className={`inv-doc-stamp ${stampClass}`}>{status.toUpperCase()}</div>

      <div className="inv-doc-top">
        <div className="inv-doc-title">QUOTE</div>
        <div className="inv-doc-logo">
          {data.logo ? <img src={data.logo} alt="logo" /> : 'LOGO'}
        </div>
      </div>

      <div className="inv-doc-meta-row">
        <div className="inv-doc-meta-left">
          <div><strong>Quote Number:</strong> #{data.quoteNumber}</div>
          <div><strong>Date:</strong> {data.quoteDate}</div>
          <div><strong>Valid Until:</strong> {data.validUntil}</div>
        </div>
        <div className="inv-doc-meta-right">
          <div><strong>{data.fromName}</strong></div>
          {data.fromAddr && <div>{data.fromAddr}</div>}
          {data.fromPhone && <div>{data.fromPhone}</div>}
          {data.fromEmail && <div>{data.fromEmail}</div>}
          {data.gst && <div>GSTIN: {data.gst}</div>}
        </div>
      </div>

      {data.subject && (
        <div className="inv-doc-subject"><strong>Subject:</strong> {data.subject}</div>
      )}

      <div className="inv-doc-addr-row">
        <div className="inv-doc-addr-box">
          <div className="inv-doc-label">Quote For</div>
          <div><strong>{data.toName}</strong></div>
          {data.toAddr ? <div style={{ whiteSpace: 'pre-line' }}>{data.toAddr}</div> : null}
          {data.toPhone ? <div>{data.toPhone}</div> : null}
          {data.toEmail ? <div>{data.toEmail}</div> : null}
        </div>
        {data.shipTo ? (
          <div className="inv-doc-addr-box">
            <div className="inv-doc-label">Ship To</div>
            <div style={{ whiteSpace: 'pre-line' }}>{data.shipTo}</div>
          </div>
        ) : (
          <div className="inv-doc-addr-box" style={{ visibility: 'hidden' }}></div>
        )}
      </div>

      <table className="inv-doc-table">
        <thead>
          <tr><th>Item</th>{data.gst && <th>HSN/SAC</th>}<th>Qty</th><th>Price</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {data.items && data.items.length ? data.items.map((li, idx) => (
            <tr key={idx}>
              <td>
                <div style={{ fontWeight: 600 }}>{li.name || <span className="empty-line">Item name</span>}</div>
                {li.description && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{li.description}</div>}
              </td>
              {data.gst && <td>{li.hsn || '\u2014'}</td>}
              <td>{li.qty}</td>
              <td>{fmt(li.rate, currency)}</td>
              <td>{fmt(li.amount, currency)}</td>
            </tr>
          )) : (
            <tr><td colSpan={data.gst ? 5 : 4} className="empty-line">No items added yet</td></tr>
          )}
        </tbody>
      </table>

      <div className="inv-doc-totals-wrap">
        <div></div>
        <div className="inv-doc-totals">
          <div className="inv-doc-totals-row"><span>Subtotal</span><span>{fmt(data.subtotal, currency)}</span></div>
          <div className="inv-doc-totals-row"><span>Tax ({data.taxPct}%)</span><span>{fmt(data.taxAmt, currency)}</span></div>
          {data.discPct > 0 && (
            <div className="inv-doc-totals-row"><span>Discount ({data.discPct}%)</span><span>-{fmt(data.discAmt, currency)}</span></div>
          )}
          <div className="inv-doc-totals-row inv-doc-total-grand"><span>Total</span><span>{fmt(data.total, currency)}</span></div>
        </div>
      </div>

      <div className="inv-doc-words"><strong>Amount in words:</strong> {amountWords}</div>

      <div className="inv-doc-signature-row">
        <div className="inv-doc-terms">
          <div className="inv-doc-label">Terms &amp; Notes</div>
          <div style={{ whiteSpace: 'pre-line' }}>{data.notes || 'This quote is valid until the date shown above.'}</div>
          <div style={{ marginTop: '10px', color: 'var(--muted)', fontSize: '11px' }}>For any questions: {contactLine}</div>
        </div>
        <div className="inv-doc-signature">
          {data.signature ? <img src={data.signature} alt="signature" className="inv-doc-sig-img" /> : <div className="inv-doc-sig-space"></div>}
          <div className="inv-doc-sig-line"></div>
          <div className="inv-doc-sig-label">Authorized Signatory</div>
          <div className="inv-doc-sig-name">{data.fromName || ''}</div>
        </div>
      </div>

      <div className="inv-doc-disclaimer">
        {data.signature ? '' : '*This is an electronically generated quote and no signature is required.'}
      </div>
    </div>
  );
}

/**
 * Builds the `data` object for QuoteDocument from a quote snapshot + company.
 * Mirrors invoiceToDocData from InvoiceDocument.jsx.
 */
export function quoteToDocData(q, company, signature) {
  const s = q.snapshot || {};
  const items = (s.items || []).map((li) => ({
    name: li.name, description: li.description, hsn: li.hsn,
    qty: li.qty, rate: li.rate, amount: (li.qty || 0) * (li.rate || 0)
  }));
  const subtotal = items.reduce((sum, li) => sum + li.amount, 0);
  const taxPct = parseFloat(s.taxPct) || 0;
  const discPct = parseFloat(s.discountPct) || 0;
  const taxAmt = subtotal * taxPct / 100;
  const discAmt = subtotal * discPct / 100;
  const total = subtotal + taxAmt - discAmt;
  return {
    quoteNumber: q.number, quoteDate: q.date, validUntil: q.validUntil,
    subject: s.subject, status: q.status,
    fromName: company?.name || '', fromAddr: company?.address || '',
    fromPhone: company?.contact ? (company.contactCode || '') + ' ' + company.contact : '',
    fromEmail: company?.email || '', gst: company?.gst || '',
    logo: company?.logo || null,
    toName: q.client, toAddr: s.toAddr, toPhone: s.toPhone, toEmail: s.toEmail,
    shipTo: s.shipTo,
    items, subtotal, taxPct, taxAmt, discPct, discAmt, total,
    notes: s.notes, signature: signature || s.signature || null
  };
}