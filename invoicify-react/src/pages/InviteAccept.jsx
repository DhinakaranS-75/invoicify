import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

const ROLE_TEXT = {
  admin: 'Admin — full control',
  staff: 'Staff — create & edit',
  worker: 'Worker — view only',
  auditor: 'Auditor — view & reports'
};

// Opened from the "Accept Invitation" button in the invite email:
//   /invite/<token>
// Until this is accepted the member cannot log in.
export default function InviteAccept() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const token = decodeURIComponent(pathname.split('/invite/')[1] || '');

  const [state, setState] = useState('loading'); // loading | ready | accepting | done | error
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setState('error'); setError('This invitation link is incomplete.'); return; }
      try {
        const res = await api.get(`/api/auth/invite/${token}`);
        if (cancelled) return;
        setInvite(res.invite);
        setState('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'This invitation link is invalid or has expired.');
        setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const accept = async () => {
    setState('accepting');
    try {
      await api.post(`/api/auth/invite/${token}/accept`);
      setState('done');
    } catch (err) {
      setError(err.message || 'Could not accept the invitation. Please try again.');
      setState('error');
    }
  };

  const goToLogin = () => navigate('/', { replace: true });

  return (
    <div className="auth-screen" id="auth-screen">
      <div className="blob b1"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#17b3a3" /></svg></div>
      <div className="blob b2"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#17b3a3" /></svg></div>
      <div className="blob b3"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#f2703c" /></svg></div>
      <div className="blob b4"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#f2703c" /></svg></div>

      <div className="auth-card">
        {state === 'loading' && (
          <>
            <h1 className="auth-title">Checking invitation…</h1>
            <p className="auth-sub">One moment please.</p>
          </>
        )}

        {(state === 'ready' || state === 'accepting') && invite && (
          <>
            <div className="invite-badge"><i className="fa-solid fa-envelope-open-text"></i></div>
            <h1 className="auth-title">You're invited</h1>
            <p className="auth-sub">
              {invite.invitedBy ? `${invite.invitedBy} invited you` : 'You have been invited'}
              {invite.company ? ` to join ${invite.company}` : ''} on InvoicifysPro.
            </p>

            <div className="invite-summary">
              <div className="invite-row"><span>Name</span><strong>{invite.name}</strong></div>
              <div className="invite-row"><span>Email</span><strong>{invite.email}</strong></div>
              <div className="invite-row"><span>Role</span><strong>{ROLE_TEXT[invite.role] || invite.role}</strong></div>
            </div>

            <p className="invite-note">
              <i className="fa-solid fa-circle-info"></i>
              Accept and we'll email you a temporary password. You'll set your own password the first time you log in.
            </p>

            <button className="btn btn-orange btn-block" onClick={accept} disabled={state === 'accepting'}>
              {state === 'accepting' ? 'Accepting…' : 'Accept Invitation'}
            </button>
            <div className="auth-links"><a onClick={goToLogin}>Not you? Go to login</a></div>
          </>
        )}

        {state === 'done' && (
          <>
            <div className="invite-badge ok"><i className="fa-solid fa-circle-check"></i></div>
            <h1 className="auth-title">Invitation accepted</h1>
            <p className="auth-sub">
              We've emailed a temporary password to <strong>{invite?.email}</strong>. Log in with it and you'll be asked to
              choose your own password right away.
            </p>
            <button className="btn btn-orange btn-block" onClick={goToLogin}>Go to login</button>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="invite-badge bad"><i className="fa-solid fa-circle-exclamation"></i></div>
            <h1 className="auth-title">Invitation problem</h1>
            <p className="auth-sub">{error}</p>
            <p className="invite-note">
              <i className="fa-solid fa-circle-info"></i>
              Ask your admin to send you a fresh invitation from Settings → Team Members.
            </p>
            <button className="btn btn-orange btn-block" onClick={goToLogin}>Go to login</button>
          </>
        )}
      </div>
    </div>
  );
}
