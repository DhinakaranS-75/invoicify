import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

export default function TermsUpdateModal() {
  const { acceptTerms } = useData();
  const { toast } = useToast();
  const [accepting, setAccepting] = useState(false);

  const accept = async () => {
    setAccepting(true);
    try {
      await acceptTerms();
    } catch (err) {
      toast('Could not save', err.message || 'Please try again.', 'error');
      setAccepting(false);
    }
  };

  return (
    <div className="confirm-overlay show">
      <div className="confirm-box terms-update-box" style={{ textAlign: 'left', maxWidth: '440px' }}>
        <h3 style={{ margin: '0 0 10px' }}>Updates to our Terms &amp; Privacy</h3>
        <p style={{ margin: '0 0 14px' }}>
          We've added a policy on account inactivity, so you always know what to expect:
        </p>
        <table className="terms-update-table">
          <tbody>
            <tr><td>15 days</td><td>Reminder email if no one's logged in</td></tr>
            <tr><td>25 days</td><td>Second reminder</td></tr>
            <tr><td>30 days</td><td>Deletion scheduled, final notice sent</td></tr>
            <tr><td>37 days</td><td>Account &amp; data deleted, if still inactive</td></tr>
          </tbody>
        </table>
        <p style={{ margin: '14px 0 18px' }}>
          Logging in — like you just did — always resets this. Nothing else to do.{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer">Read the full Terms</a>
          {' & '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
        </p>
        <div className="confirm-actions" style={{ flexDirection: 'row' }}>
          <button className="btn btn-small btn-teal" onClick={accept} disabled={accepting}>
            {accepting ? 'Saving…' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}