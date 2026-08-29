import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { isValidEmail } from '../utils/format';
import { api } from '../utils/api';
import OtpInput from '../components/OtpInput';
import PasswordStrength from '../components/PasswordStrength';

// The installed app (PWA/TWA) always lands here with a plain "/" — there's
// no /login or /signup in the URL to go on. So the very first time this
// device ever opens the auth screen we default to Signup (a fresh install
// almost always means a brand-new user); every time after that, once this
// flag is set, we default to Login instead.
const LAUNCHED_KEY = 'invoicify_launched_before';

export default function AuthScreen() {
  const initialLocation = useLocation();
  const [view, setView] = useState(() => {
    if (initialLocation.pathname.startsWith('/signup')) return 'register';
    if (initialLocation.pathname.startsWith('/login')) return 'login';
    return localStorage.getItem(LAUNCHED_KEY) ? 'login' : 'register';
  }); // login | register | forgot | reset | setpw
  useEffect(() => {
    localStorage.setItem(LAUNCHED_KEY, '1');
  }, []);
  const [resetEmail, setResetEmail] = useState('');
  // Credentials of an invited member who just logged in with a temporary password
  const [pending, setPending] = useState(null);
  return (
    <div className="auth-screen" id="auth-screen">
      <div className="blob b1"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#17b3a3" /></svg></div>
      <div className="blob b2"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#17b3a3" /></svg></div>
      <div className="blob b3"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#f2703c" /></svg></div>
      <div className="blob b4"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#f2703c" /></svg></div>

      <div className={'auth-card' + (view === 'register' ? ' wide' : '')}>
        {view === 'login' && <LoginForm goTo={setView} setPending={setPending} />}
        {view === 'register' && <RegisterForm goTo={setView} />}
        {view === 'forgot' && <ForgotForm goTo={setView} setResetEmail={setResetEmail} />}
        {view === 'reset' && <ResetForm goTo={setView} resetEmail={resetEmail} />}
        {view === 'setpw' && <SetPasswordForm goTo={setView} pending={pending} />}
      </div>
    </div>
  );
}

function Field({ label, children, error, shake }) {
  return (
    <div className={'field' + (shake ? ' shake' : '')}>
      <label>{label}</label>
      <div className="input-wrap">{children}</div>
      {error && <div className="error-text show">{error}</div>}
    </div>
  );
}

function LoginForm({ goTo, setPending }) {
  const { login } = useData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [shake, setShake] = useState(false);
  const doShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };

  const submit = async () => {
    const errs = {};
    if (!isValidEmail(email)) errs.email = 'Enter a valid email address.';
    if (!password) errs.password = 'Enter your password.';
    if (Object.keys(errs).length) { setErrors(errs); doShake(); return; }
    setErrors({});
    try {
      const res = await login(email, password);

      // Invited member logging in with their temporary password:
      // don't sign them in — make them choose their own password first.
      if (res?.mustResetPassword) {
        setPending({ email: email.trim(), tempPassword: password, name: res.name });
        toast('Almost there', 'Temporary password accepted — now choose your own password.');
        goTo('setpw');
        return;
      }

      navigate('/home', { replace: true });
      toast('Welcome back', `Signed in as ${res.user.name}.`);
    } catch (err) {
      // For security the server never says whether the email or the password
      // was wrong, so we highlight the password field (the one people re-type)
      // and show our own clean message rather than echoing the API text.
      const network = /network|fetch|failed to/i.test(err?.message || '');
      const msg = network
        ? 'Could not reach the server. Please check your connection and try again.'
        : 'Incorrect email or password. Please try again.';
      setErrors({ password: msg });
      doShake();
      toast('Login failed', msg, 'error');
    }
  };

  return (
    <>
      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-sub">Log in to manage your invoices.</p>
      <Field label="Email" error={errors.email} shake={shake}>
        <input className={errors.email ? 'invalid' : ''} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      </Field>
      <Field label="Password" error={errors.password} shake={shake}>
        <input className={errors.password ? 'invalid' : ''} type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
        <button type="button" className="toggle-eye" onClick={() => setShowPw((s) => !s)}>
          <i className={'fa-solid ' + (showPw ? 'fa-eye-slash' : 'fa-eye')}></i>
        </button>
      </Field>
      <a className="forgot-link" onClick={() => goTo('forgot')}>Forgot password?</a>
      <button className="btn btn-orange btn-block" onClick={submit}>Login</button>
      <div className="auth-links">Don't have an account? <a onClick={() => goTo('register')}>Sign up</a></div>
    </>
  );
}

function RegisterForm({ goTo }) {
  const { registerUser } = useData();
  const { toast } = useToast();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [shake, setShake] = useState(false);
  const doShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  // Live confirm-password feedback — a green tick shows the moment it
  // matches (positive feedback is never annoying). The red "doesn't match"
  // message only shows once the field has been left at least once, or the
  // typed length already reaches the password's length — either way means
  // they're done typing, not mid-keystroke, so it won't flash red early.
  const confirmMatches = f.confirm.length > 0 && f.confirm === f.password;
  const showConfirmMismatch = f.confirm.length > 0 && !confirmMatches
    && (confirmTouched || f.confirm.length >= f.password.length);
  const confirmError = errors.confirm || (showConfirmMismatch ? "Passwords don't match yet." : undefined);

  const submit = async () => {
    const errs = {};
    if (f.firstName.trim().length < 2) errs.firstName = 'Enter your first name.';
    if (f.lastName.trim().length < 1) errs.lastName = 'Enter your last name.';
    if (!isValidEmail(f.email)) errs.email = 'Enter a valid email.';
    if (f.password.length < 8) errs.password = 'Min 8 characters.';
    if (f.password !== f.confirm) errs.confirm = 'Passwords do not match.';
    if (!agreeToTerms) errs.terms = 'You must agree to the Terms and Privacy Policy to continue.';
    setErrors(errs);
    if (Object.keys(errs).length) { doShake(); return; }
    try {
      // No role is sent: anyone who signs up is the company Admin (full control).
      // Everyone else joins through Settings -> Team Members as an invite.
      await registerUser({
        firstName: f.firstName, lastName: f.lastName,
        email: f.email, password: f.password
      });
      toast('Account created', 'You can now log in.');
      goTo('login');
    } catch (err) {
      setErrors({ email: err.message || 'Registration failed.' });
      doShake();
      toast('Registration failed', err.message || 'Please try again.', 'error');
    }
  };

  return (
    <>
      <h1 className="auth-title">Create account</h1>
      <p className="auth-sub">Start invoicing in minutes.</p>
      <div className="grid2">
        <Field label="First Name" error={errors.firstName} shake={shake}>
          <input className={errors.firstName ? 'invalid' : ''} value={f.firstName} onChange={set('firstName')} placeholder="John" />
        </Field>
        <Field label="Last Name" error={errors.lastName} shake={shake}>
          <input className={errors.lastName ? 'invalid' : ''} value={f.lastName} onChange={set('lastName')} placeholder="Doe" />
        </Field>
      </div>
      <Field label="Email" error={errors.email} shake={shake}>
        <input className={errors.email ? 'invalid' : ''} type="email" value={f.email} onChange={set('email')} placeholder="you@company.com" />
      </Field>
      <Field label="Password" error={errors.password} shake={shake}>
        <input className={errors.password ? 'invalid' : ''} type={showPw ? 'text' : 'password'} value={f.password} onChange={set('password')} placeholder="Min 8 characters" />
        <button type="button" className="toggle-eye" onClick={() => setShowPw((s) => !s)}>
          <i className={'fa-solid ' + (showPw ? 'fa-eye-slash' : 'fa-eye')}></i>
        </button>
      </Field>
      <PasswordStrength password={f.password} />
      <Field label="Confirm Password" error={confirmError} shake={shake}>
        <input
          className={(errors.confirm || showConfirmMismatch) ? 'invalid' : ''}
          type={showConfirm ? 'text' : 'password'}
          value={f.confirm}
          onChange={set('confirm')}
          onBlur={() => setConfirmTouched(true)}
          placeholder="Re-enter password"
        />
        {confirmMatches && (
          <span className="confirm-match-tick" title="Passwords match">
            <i className="fa-solid fa-circle-check"></i>
          </span>
        )}
        <button type="button" className="toggle-eye" onClick={() => setShowConfirm((s) => !s)}>
          <i className={'fa-solid ' + (showConfirm ? 'fa-eye-slash' : 'fa-eye')}></i>
        </button>
      </Field>
      <label className="terms-check" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '14px 0', fontSize: '13px', lineHeight: 1.5, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={agreeToTerms}
          onChange={(e) => { setAgreeToTerms(e.target.checked); setErrors((p) => ({ ...p, terms: undefined })); }}
          style={{ marginTop: '2px' }}
        />
        <span>
          I agree to the{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
        </span>
      </label>
      {errors.terms && <p style={{ color: 'var(--danger)', fontSize: '12.5px', margin: '-8px 0 12px' }}>{errors.terms}</p>}
      <button className="btn btn-orange btn-block" onClick={submit} disabled={!agreeToTerms}>Signup</button>
      <div className="auth-links">Already have an account? <a onClick={() => goTo('login')}>Login</a></div>
    </>
  );
}

function ForgotForm({ goTo, setResetEmail }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!isValidEmail(email)) { setError('Enter a valid email.'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setResetEmail(email);
      toast('Check your email', 'We sent a 6-digit reset code. It expires in 10 minutes.');
      goTo('reset');
    } catch (err) {
      // Don't reveal whether the email exists — show the same message either way
      setResetEmail(email);
      toast('Check your email', 'If that email is registered, a reset code is on its way.');
      goTo('reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="auth-title">Forgot password</h1>
      <p className="auth-sub">Enter your email and we'll send a reset code.</p>
      <Field label="Email" error={error}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      </Field>
      <button className="btn btn-orange btn-block" onClick={submit} disabled={loading}>
        {loading ? 'Sending…' : 'Send reset code'}
      </button>
      <div className="auth-links"><a onClick={() => goTo('login')}>Back to login</a></div>
    </>
  );
}

function ResetForm({ goTo, resetEmail }) {
  const { toast } = useToast();
  const [otp, setOtp] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  // Same live feedback as the signup form — green tick the moment it
  // matches; red "doesn't match" only once they've left the field or
  // typed enough to reach the password's length.
  const confirmMatches = confirm.length > 0 && confirm === pw;
  const showConfirmMismatch = confirm.length > 0 && !confirmMatches
    && (confirmTouched || confirm.length >= pw.length);

  const submit = async () => {
    if (!/^\d{6}$/.test(otp.trim())) { setError('Enter the 6-digit code from your email.'); return; }
    if (pw.length < 8) { setError('Min 8 characters.'); return; }
    if (pw !== confirm) { setError('Passwords do not match.'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { email: resetEmail, otp: otp.trim(), newPassword: pw });
      toast('Password reset', 'Log in with your new password.');
      goTo('login');
    } catch (err) {
      setError(err.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="auth-title">Set new password</h1>
      <p className="auth-sub">Enter the code sent to {resetEmail || 'your email'} and choose a new password.</p>
      <Field label="Reset Code">
        <OtpInput value={otp} onChange={setOtp} length={6} />
      </Field>
      <Field label="New Password">
        <input type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Min 8 characters" />
        <button type="button" className="toggle-eye" onClick={() => setShowPw((s) => !s)}>
          <i className={'fa-solid ' + (showPw ? 'fa-eye-slash' : 'fa-eye')}></i>
        </button>
      </Field>
      <PasswordStrength password={pw} />
      <Field label="Confirm Password" error={error || (showConfirmMismatch ? "Passwords don't match yet." : '')}>
        <input
          className={showConfirmMismatch ? 'invalid' : ''}
          type={showConfirm ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onBlur={() => setConfirmTouched(true)}
          placeholder="Re-enter password"
        />
        {confirmMatches && (
          <span className="confirm-match-tick" title="Passwords match">
            <i className="fa-solid fa-circle-check"></i>
          </span>
        )}
        <button type="button" className="toggle-eye" onClick={() => setShowConfirm((s) => !s)}>
          <i className={'fa-solid ' + (showConfirm ? 'fa-eye-slash' : 'fa-eye')}></i>
        </button>
      </Field>
      <button className="btn btn-orange btn-block" onClick={submit} disabled={loading}>
        {loading ? 'Resetting…' : 'Reset Password'}
      </button>
      <div className="auth-links">
        <a onClick={() => goTo('forgot')}>Resend code</a> · <a onClick={() => goTo('login')}>Back to login</a>
      </div>
    </>
  );
}

function SetPasswordForm({ goTo, pending }) {
  const { toast } = useToast();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (pw.length < 8) { setError('Min 8 characters.'); return; }
    if (pw !== confirm) { setError('Passwords do not match.'); return; }
    if (pending?.tempPassword && pw === pending.tempPassword) {
      setError('Choose a password different from the temporary one.'); return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/set-password', {
        email: pending?.email,
        tempPassword: pending?.tempPassword,
        newPassword: pw
      });
      toast('Password set', 'Now log in with your new password.');
      goTo('login');
    } catch (err) {
      setError(err.message || 'Could not set your password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="auth-title">Choose your password</h1>
      <p className="auth-sub">
        Welcome{pending?.name ? `, ${pending.name.split(' ')[0]}` : ''}! Your temporary password works only once —
        set your own password to finish setting up your account.
      </p>
      <Field label="New Password">
        <input type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Min 8 characters" />
        <button type="button" className="toggle-eye" onClick={() => setShowPw((s) => !s)}>
          <i className={'fa-solid ' + (showPw ? 'fa-eye-slash' : 'fa-eye')}></i>
        </button>
      </Field>
      <PasswordStrength password={pw} />
      <Field label="Confirm Password" error={error}>
        <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" />
        <button type="button" className="toggle-eye" onClick={() => setShowConfirm((s) => !s)}>
          <i className={'fa-solid ' + (showConfirm ? 'fa-eye-slash' : 'fa-eye')}></i>
        </button>
      </Field>
      <button className="btn btn-orange btn-block" onClick={submit} disabled={loading}>
        {loading ? 'Saving…' : 'Set Password & Continue'}
      </button>
      <div className="auth-links"><a onClick={() => goTo('login')}>Back to login</a></div>
    </>
  );
}
