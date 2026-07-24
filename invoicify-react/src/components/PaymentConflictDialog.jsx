import { fmt } from '../utils/format';

/**
 * Shown when an invoice with recorded payments is moved to a status that
 * isn't "Paid" (Draft, Sent, Unpaid, Overdue).
 *
 * Money received is money received — the app never silently deletes a payment
 * just because a label changed, and income figures always follow the payment
 * records, not the status. So the user has to say explicitly what they meant:
 * was the payment a mistake (remove it), or is the status just being corrected
 * (keep it)?
 */
export default function PaymentConflictDialog({
  invoiceNumber, paidAmount, newStatus, currency, onRemove, onKeep, onCancel
}) {
  return (
    <div className="confirm-overlay show" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="confirm-box">
        <div className="confirm-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
        <h3>This invoice has a payment on it</h3>
        <p>
          {invoiceNumber} has <strong>{fmt(paidAmount, currency)}</strong> recorded as received, but you're
          setting it to <strong>{newStatus}</strong>. Income reports count the payment, not the status —
          so what should happen to it?
        </p>
        <div className="pc-choices">
          <button className="pc-choice" onClick={onRemove}>
            <span className="pc-choice-title"><i className="fa-solid fa-trash-can"></i> Remove the payment</span>
            <span className="pc-choice-sub">It was recorded by mistake. Income drops by {fmt(paidAmount, currency)}.</span>
          </button>
          <button className="pc-choice" onClick={onKeep}>
            <span className="pc-choice-title"><i className="fa-solid fa-check"></i> Keep the payment</span>
            <span className="pc-choice-sub">The money did arrive. Only the status label changes.</span>
          </button>
        </div>
        <div className="confirm-actions">
          <button className="btn btn-small btn-outline" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
