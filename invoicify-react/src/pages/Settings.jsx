import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import { isValidEmail, ROLE_LABELS } from '../utils/format';
import { buildInvoiceNumber } from '../utils/invoiceNumber';
import { INDIA_STATES } from '../utils/locationData';
import { api } from '../utils/api';
import OtpInput from '../components/OtpInput';

const TEMPLATES = [
  { id: 'classic', name: 'Classic', desc: 'Colorful bands, bold and friendly.',
    thumb: (<><div className="tt-band"></div><div className="tt-title">INVOICE</div><div className="tt-line"></div><div className="tt-line short"></div><div className="tt-table"></div></>) },
  { id: 'corporate', name: 'Corporate', desc: 'Formal, minimal, business-ready.',
    thumb: (<><div className="tt-title dark">INVOICE</div><div className="tt-rule"></div><div className="tt-line"></div><div className="tt-line short"></div><div className="tt-table" style={{ borderTopColor: '#1b1c33' }}></div></>) },
  { id: 'creative', name: 'Creative', desc: 'Stylish accent sidebar, modern look.',
    thumb: (<><div className="tt-sidebar"></div><div className="tt-title accent">INVOICE</div><div className="tt-line"></div><div className="tt-line short"></div><div className="tt-table" style={{ borderTopColor: 'var(--teal)' }}></div></>) },
  { id: 'minimal', name: 'Minimal', desc: 'Clean, borderless and airy.',
    thumb: (<><div className="tt-title" style={{ color: '#3a3a4a', fontWeight: 600, letterSpacing: '2px', marginTop: '2px' }}>INVOICE</div><div className="tt-line"></div><div className="tt-line short"></div><div className="tt-table" style={{ borderTopColor: '#dcdce6' }}></div></>) },
  { id: 'elegant', name: 'Elegant', desc: 'Serif fonts, gold luxury feel.', style: { border: '1px solid #c9a86a' },
    thumb: (<><div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg,#c9a86a,#e6cfa0,#c9a86a)' }}></div><div className="tt-title" style={{ color: '#8a6d3b', fontFamily: 'Georgia,serif', marginTop: '6px' }}>INVOICE</div><div className="tt-line"></div><div className="tt-line short"></div><div className="tt-table" style={{ borderTopColor: '#8a6d3b' }}></div></>) },
  { id: 'modern', name: 'Modern', desc: 'Bold purple header block.', style: { padding: 0 },
    thumb: (<><div style={{ background: 'linear-gradient(120deg,#5b21b6,#7c3aed)', padding: '14px 12px' }}><div className="tt-title" style={{ color: '#fff', margin: 0 }}>INVOICE</div></div><div style={{ padding: '10px 12px' }}><div className="tt-line"></div><div className="tt-line short"></div><div className="tt-table" style={{ borderTopColor: '#5b21b6' }}></div></div></>) },
  { id: 'redline', name: 'Redline', desc: 'Red & charcoal, striped rows.', style: { padding: '12px' },
    thumb: (<><div className="tt-title" style={{ color: '#e0335c', marginTop: '2px' }}>INVOICE</div><div className="tt-line"></div><div className="tt-line short"></div><div className="tt-table" style={{ borderTopColor: '#2b2f3a' }}></div><div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '10px', background: 'linear-gradient(100deg,#e0335c 30%,#2b2f3a 30%)' }}></div></>) },
  { id: 'executive', name: 'Executive', desc: 'Black & white, bordered formal.', style: { padding: 0 },
    thumb: (<><div style={{ background: '#1b1c1c', padding: '14px 12px' }}><div className="tt-title" style={{ color: '#fff', margin: 0 }}>INVOICE</div></div><div style={{ padding: '10px 12px' }}><div className="tt-line"></div><div className="tt-line short"></div><div className="tt-table" style={{ borderTopColor: '#1b1c1c' }}></div></div></>) },
  { id: 'goldline', name: 'Goldline', desc: 'White & gold, elegant clean.', style: { padding: '12px' },
    thumb: (<><div className="tt-title" style={{ color: '#2a2a2a', fontWeight: 600, letterSpacing: '2px', marginTop: '2px' }}>INVOICE</div><div className="tt-line"></div><div className="tt-line short"></div><div className="tt-table" style={{ borderTopColor: '#d4af37' }}></div><div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '8px', background: 'linear-gradient(90deg,#d4af37,#e8d199,#d4af37)' }}></div></>) }
];

const TABS = [
  { id: 'profile', label: 'My Profile', icon: 'fa-user' },
  { id: 'company', label: 'Company Details', icon: 'fa-building' },
  { id: 'preferences', label: 'Preferences', icon: 'fa-sliders' },
  { id: 'team', label: 'Team Members', icon: 'fa-users-gear' }
];

export default function Settings() {
  const location = useLocation();
  const [tab, setTab] = useState(location.state?.tab || 'profile');
  const [drilled, setDrilled] = useState(false); // mobile drill-down
  const { can } = usePermissions();

  const visibleTabs = TABS.filter((t) => t.id !== 'team' || can('manageTeam'));

  const MOBILE = '(max-width:900px)'; // drill-down UI only exists at this width

  const openTab = (id) => { setTab(id); setDrilled(true); };
  const backToList = () => {
    // On mobile, consume the history entry we pushed so the back-stack stays clean.
    // history.back() triggers popstate, which sets drilled=false (see effect below).
    if (window.matchMedia(MOBILE).matches) window.history.back();
    else setDrilled(false);
  };

  // Mobile only: make the browser Back button close the open panel first, instead of
  // leaving the Settings page entirely. Desktop (>900px) back button is left untouched.
  useEffect(() => {
    if (!drilled) return;
    if (!window.matchMedia(MOBILE).matches) return;
    window.history.pushState({ settingsDrill: true }, '');
    const onPop = () => setDrilled(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [drilled]);

  return (
    <div className="page active">
      <div className="app-header-row">
        <div><h1>Settings</h1><p className="hide-mobile">Manage your account, company, and preferences.</p></div>
      </div>

      <div className={'settings-layout' + (drilled ? ' drilled' : '')}>
        <div className="settings-tabs">
          {visibleTabs.map((t) => (
            <button key={t.id} className={'settings-tab' + (tab === t.id ? ' active' : '')} onClick={() => openTab(t.id)}>
              <i className={'fa-solid ' + t.icon}></i> {t.label} <i className="fa-solid fa-chevron-right tab-chevron"></i>
            </button>
          ))}
        </div>

        <div className="settings-content">
          <div className="settings-back" onClick={backToList}><i className="fa-solid fa-arrow-left"></i> Back to Settings</div>
          {tab === 'profile' && <ProfileTab />}
          {tab === 'company' && <CompanyTab />}
          {tab === 'preferences' && <PreferencesTab />}
          {tab === 'team' && can('manageTeam') && <TeamTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  const { currentUser, updateCurrentUser, setCurrentUser, deleteAccount } = useData();
  const { toast } = useToast();
  const [f, setF] = useState({
    firstName: currentUser?.firstName || '', lastName: currentUser?.lastName || '', email: currentUser?.email || ''
  });
  const [delOpen, setDelOpen] = useState(false);
  const [delData, setDelData] = useState(false);
  const [delConfirm, setDelConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const initial = (currentUser?.name || 'U').trim().charAt(0).toUpperCase();

  const confirmDelete = async () => {
    if (delConfirm.trim().toUpperCase() !== 'DELETE') return;
    setDeleting(true);
    try {
      await deleteAccount(delData);
      // account gone → DataContext logs out → app returns to the auth screen
    } catch (err) {
      setDeleting(false);
      toast('Delete failed', err.message || 'Could not delete your account.', 'error');
    }
  };

  const onAvatar = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => updateCurrentUser({ avatar: ev.target.result });
    reader.readAsDataURL(file);
    toast('Photo updated', 'Your profile photo was changed.');
  };

  const save = async () => {
    if (f.firstName.trim().length < 1) { toast('First name required', 'Please enter your first name.', 'error'); return; }
    if (!isValidEmail(f.email)) { toast('Invalid email', 'Please enter a valid email.', 'error'); return; }
    try {
      await updateCurrentUser({ firstName: f.firstName, lastName: f.lastName, email: f.email });
      toast('Profile saved', 'Your changes were saved.');
    } catch (err) {
      toast('Save failed', err.message || 'Could not save profile.', 'error');
    }
  };

  const sendVerifyOtp = async () => {
    setSendingOtp(true);
    try {
      const res = await api.post('/api/auth/send-email-verify-otp');
      toast('Code sent', res.message || `Check ${currentUser?.email}.`);
      setOtp('');
      setOtpOpen(true);
    } catch (err) {
      toast('Could not send code', err.message || 'Please try again.', 'error');
    } finally {
      setSendingOtp(false);
    }
  };

  const confirmVerifyOtp = async () => {
    if (otp.length !== 6) { toast('Enter the 6-digit code', 'Fill in every box.', 'error'); return; }
    setVerifyingOtp(true);
    try {
      const res = await api.post('/api/auth/verify-email-otp', { otp });
      setCurrentUser(res.user);
      toast('Email verified', 'Your email address is now confirmed.');
      setOtpOpen(false);
    } catch (err) {
      toast('Verification failed', err.message || 'Incorrect or expired code.', 'error');
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <div className="settings-panel active">
      <div className="panel" style={{ maxWidth: '620px' }}>
        <div className="profile-menu-header">
          <div className="profile-avatar-big">
            {currentUser?.avatar ? <img src={currentUser.avatar} alt="me" /> : <span>{initial}</span>}
            <label className="avatar-upload-btn" title="Change photo">
              <i className="fa-solid fa-camera"></i>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatar} />
            </label>
          </div>
          <div>
            <div className="profile-menu-name">{currentUser?.name}</div>
            <div className="profile-menu-email">{currentUser?.email}</div>
          </div>
        </div>
        <div className="profile-info-row"><span>Company</span><strong>{currentUser?.company?.name || '—'}</strong></div>
        <div className="profile-info-row"><span>User ID</span><strong>{currentUser?.id ? 'USR-' + String(currentUser.id).slice(-6).toUpperCase() : '—'}</strong></div>
        <div className="profile-info-row"><span>Company ID</span><strong>{currentUser?.companyId || '—'}</strong></div>

        <div className="section-gap">
          <h3>Edit Profile</h3>
          <div className="grid2">
            <div className="field-sm"><label>First Name</label><input value={f.firstName} onChange={set('firstName')} placeholder="John" /></div>
            <div className="field-sm"><label>Last Name</label><input value={f.lastName} onChange={set('lastName')} placeholder="Doe" /></div>
          </div>
          <div className="field-sm">
            <label>Email</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="email" value={f.email} onChange={set('email')} placeholder="johndoe@gmail.com" style={{ flex: 1 }} />
              {currentUser?.emailVerified ? (
                <span title="Verified" style={{ color: 'var(--success)', fontSize: '18px', flex: 'none' }}>
                  <i className="fa-solid fa-circle-check"></i>
                </span>
              ) : (
                <>
                  <span title="Not verified" style={{ color: 'var(--danger)', fontSize: '18px', flex: 'none' }}>
                    <i className="fa-solid fa-circle-xmark"></i>
                  </span>
                  <button className="btn btn-small btn-outline" style={{ flex: 'none' }} onClick={sendVerifyOtp} disabled={sendingOtp}>
                    {sendingOtp ? 'Sending…' : 'Verify'}
                  </button>
                </>
              )}
            </div>
          </div>
          <button className="btn btn-small btn-orange" onClick={save}>Save Changes</button>
        </div>

        <div className="section-gap danger-zone">
          <h3 style={{ color: 'var(--danger)' }}>Danger Zone</h3>
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '-4px 0 12px' }}>Permanently delete your account. This cannot be undone.</p>
          <button className="btn btn-small" style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => { setDelData(false); setDelConfirm(''); setDelOpen(true); }}>
            <i className="fa-solid fa-trash-can"></i> Delete Account
          </button>
        </div>
      </div>

      {/* Email verification code entry */}
      <div className={'confirm-overlay' + (otpOpen ? ' show' : '')} onClick={(e) => { if (e.target === e.currentTarget && !verifyingOtp) setOtpOpen(false); }}>
        <div className="confirm-box" style={{ textAlign: 'left', maxWidth: '400px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div className="confirm-icon" style={{ margin: 0, width: '44px', height: '44px', fontSize: '18px', background: 'rgba(23,179,163,.12)', color: 'var(--teal)' }}><i className="fa-solid fa-envelope-circle-check"></i></div>
            <h3 style={{ margin: 0 }}>Verify your email</h3>
          </div>
          <p style={{ margin: '6px 0 16px', color: 'var(--muted)', fontSize: '13.5px' }}>Enter the 6-digit code sent to <strong>{currentUser?.email}</strong>.</p>
          <div style={{ marginBottom: '16px' }}>
            <OtpInput value={otp} onChange={setOtp} />
          </div>
          <div className="confirm-actions" style={{ flexDirection: 'row' }}>
            <button className="btn btn-small btn-orange" disabled={otp.length !== 6 || verifyingOtp} onClick={confirmVerifyOtp}>
              {verifyingOtp ? 'Verifying…' : 'Verify Email'}
            </button>
            <button className="btn btn-small btn-outline" disabled={verifyingOtp} onClick={() => setOtpOpen(false)}>Cancel</button>
          </div>
          <button className="pd-link-btn" style={{ marginTop: '12px', fontSize: '12.5px', background: 'none', border: 'none', color: 'var(--navy)', cursor: 'pointer' }} onClick={sendVerifyOtp} disabled={sendingOtp}>
            {sendingOtp ? 'Resending…' : "Didn't get it? Resend code"}
          </button>
        </div>
      </div>

      {/* Delete account confirmation */}
      <div className={'confirm-overlay' + (delOpen ? ' show' : '')} onClick={(e) => { if (e.target === e.currentTarget && !deleting) setDelOpen(false); }}>
        <div className="confirm-box" style={{ textAlign: 'left', maxWidth: '440px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div className="confirm-icon" style={{ margin: 0, width: '44px', height: '44px', fontSize: '18px', background: 'rgba(224,51,92,.12)', color: 'var(--danger)' }}><i className="fa-solid fa-triangle-exclamation"></i></div>
            <h3 style={{ margin: 0 }}>Delete account?</h3>
          </div>
          <p style={{ margin: '6px 0 14px', color: 'var(--muted)', fontSize: '13.5px' }}>This permanently deletes your account (<strong>{currentUser?.email}</strong>). This action <strong>cannot be undone</strong>.</p>
          <label className="checkbox-row" style={{ alignItems: 'flex-start', marginBottom: '14px' }}>
            <input type="checkbox" checked={delData} onChange={(e) => setDelData(e.target.checked)} />
            <span style={{ fontSize: '13px', color: '#3a3a5c' }}>Also permanently delete all my <strong>invoices, customers and items</strong>. (If left unchecked, only my login is removed.)</span>
          </label>
          <div className="field-sm"><label>Type <strong>DELETE</strong> to confirm</label><input value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} placeholder="DELETE" /></div>
          <div className="confirm-actions" style={{ flexDirection: 'row', marginTop: '8px' }}>
            <button className="btn btn-small" style={{ background: 'var(--danger)', color: '#fff', opacity: (delConfirm.trim().toUpperCase() === 'DELETE' && !deleting) ? 1 : 0.5 }} disabled={delConfirm.trim().toUpperCase() !== 'DELETE' || deleting} onClick={confirmDelete}>
              {deleting ? 'Deleting…' : 'Delete Account'}
            </button>
            <button className="btn btn-small btn-outline" disabled={deleting} onClick={() => setDelOpen(false)}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompanyTab() {
  const { currentUser, updateCurrentUser, companySignature, setCompanySignature } = useData();
  const { toast } = useToast();
  const c = currentUser?.company || {};
  const [f, setF] = useState({
    name: c.name || '', email: c.email || '', contact: c.contact || '', contactCode: c.contactCode || '+91',
    address: c.address || '', state: c.state || '',
    country: c.country || 'India', gst: c.gst || '', bankName: c.bankName || '',
    accountNumber: c.accountNumber || '', ifsc: c.ifsc || '', terms: c.terms || '', logo: c.logo || null
  });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const onLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setF((p) => ({ ...p, logo: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const onSignature = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setCompanySignature(ev.target.result); toast('Signature uploaded', 'Applied to all invoices.'); };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (f.name.trim().length < 1) { toast('Company name required', 'Please enter your company name.', 'error'); return; }
    try {
      await updateCurrentUser({ company: { ...c, ...f } });
      toast('Company saved', 'Your company details were updated.');
    } catch (err) {
      toast('Save failed', err.message || 'Could not save company details.', 'error');
    }
  };

  return (
    <div className="settings-panel active">
      <div className="panel" style={{ maxWidth: '620px' }}>
        <h3>Company Details</h3>
        <div className="logo-upload">
          <div className="logo-preview">{f.logo ? <img src={f.logo} alt="logo" /> : <i className="fa-solid fa-building"></i>}</div>
          <div className="logo-upload-text"><div className="lu-title">Company Logo</div><div className="lu-sub">Appears on invoices</div></div>
          <label className="file-btn">Upload<input type="file" accept="image/*" style={{ display: 'none' }} onChange={onLogo} /></label>
        </div>
        <div className="field-sm"><label>Company Name</label><input value={f.name} onChange={set('name')} placeholder="Your Company Pvt Ltd" /></div>
        <div className="grid2">
          <div className="field-sm"><label>Company Email</label><input type="email" value={f.email} onChange={set('email')} placeholder="[email protected]" /></div>
          <div className="field-sm">
            <label>Contact Number</label>
            <div className="phone-wrap-sm">
              <select className="phone-code-select-sm" value={f.contactCode} onChange={set('contactCode')}>
                <option value="+91">🇮🇳 +91</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
                <option value="+971">🇦🇪 +971</option>
                <option value="+61">🇦🇺 +61</option>
                <option value="+65">🇸🇬 +65</option>
                <option value="+49">🇩🇪 +49</option>
              </select>
              <input value={f.contact} onChange={(e) => setF((p) => ({ ...p, contact: e.target.value.replace(/[^0-9\s-]/g, '') }))} placeholder="98765 43210" inputMode="numeric" />
            </div>
          </div>
        </div>
        <div className="field-note" style={{ marginBottom: '12px' }}>Email &amp; phone show under "For any questions" on your invoices.</div>
        <div className="grid2">
          <div className="field-sm"><label>Address</label><input value={f.address} onChange={set('address')} placeholder="Street, City" /></div>
          <div className="field-sm"><label>State</label>
            <select value={f.state} onChange={set('state')}>
              <option value="">Select state…</option>
              {INDIA_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
              {f.state && !INDIA_STATES.includes(f.state) && <option value={f.state}>{f.state}</option>}
            </select>
          </div>
        </div>
        <div className="field-sm"><label>GST Number</label><input value={f.gst} onChange={set('gst')} placeholder="22AAAAA0000A1Z5" /></div>

        <div className="section-gap">
          <h3>Bank Details</h3>
          <div className="grid2">
            <div className="field-sm"><label>Bank Name</label><input value={f.bankName} onChange={set('bankName')} placeholder="Type bank name" /></div>
            <div className="field-sm"><label>Account Number</label><input value={f.accountNumber} onChange={(e) => setF((p) => ({ ...p, accountNumber: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="Type account number" inputMode="numeric" /></div>
          </div>
          <div className="field-sm"><label>IFSC Code</label><input value={f.ifsc} onChange={set('ifsc')} placeholder="Type IFSC code" /></div>
        </div>

        <div className="section-gap">
          <h3>Default Invoice Terms</h3>
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '-4px 0 12px' }}>Auto-filled into the Notes / Terms of every new invoice. You can still edit it per invoice.</p>
          <div className="field-sm"><label>Terms &amp; Conditions</label><textarea rows={4} value={f.terms} onChange={set('terms')} placeholder="e.g. Payment due within 15 days. Goods once sold will not be taken back. Thank you for your business!"></textarea></div>
        </div>

        <div className="section-gap">
          <h3>Signature</h3>
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '-4px 0 12px' }}>Applied to all invoices as the authorized signatory.</p>
          <div className="logo-upload">
            <div className="logo-preview">{companySignature ? <img src={companySignature} alt="signature" /> : <i className="fa-solid fa-signature"></i>}</div>
            <div className="logo-upload-text"><div className="lu-title">Digital Signature</div><div className="lu-sub">PNG with transparent background</div></div>
            <label className="file-btn">Upload<input type="file" accept="image/*" style={{ display: 'none' }} onChange={onSignature} /></label>
          </div>
          {companySignature && <button className="btn btn-small btn-outline section-gap" onClick={() => { setCompanySignature(null); toast('Signature removed', 'Removed from invoices.', 'delete'); }}>Remove Signature</button>}
        </div>

        <div className="section-gap"><button className="btn btn-small btn-orange" onClick={save}>Save Company Details</button></div>
      </div>
    </div>
  );
}

function PreferencesTab() {
  const { invoiceTemplate, setInvoiceTemplate, invoiceNumberConfig, setInvoiceNumberConfig } = useData();
  const { mode, setMode } = useTheme();
  const { toast } = useToast();
  const [cfg, setCfg] = useState(invoiceNumberConfig);
  const setC = (k) => (e) => setCfg((p) => ({ ...p, [k]: e.target.value }));

  const selectTemplate = (id) => { setInvoiceTemplate(id); localStorage.setItem('iv_onboard_tmpl', '1'); toast('Template applied', `${TEMPLATES.find((t) => t.id === id)?.name} is now your invoice design.`); };

  const saveNumbering = () => {
    setInvoiceNumberConfig({ ...cfg, padding: parseInt(cfg.padding) || 0, next: parseInt(cfg.next) || 1 });
    toast('Numbering saved', `Next invoice: ${buildInvoiceNumber({ ...cfg, padding: parseInt(cfg.padding) || 0, next: parseInt(cfg.next) || 1 })}`);
  };

  const preview = buildInvoiceNumber({ ...cfg, padding: parseInt(cfg.padding) || 0, next: parseInt(cfg.next) || 1 });

  return (
    <div className="settings-panel active">
      <div className="panel" style={{ maxWidth: '720px' }}>
        <h3>Appearance</h3>
        <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '-4px 0 16px' }}>Choose how Invoicify looks on this device.</p>
        <div className="theme-segment">
          <button className={'theme-seg-btn' + (mode === 'light' ? ' active' : '')} onClick={() => setMode('light')}>
            <i className="fa-solid fa-sun"></i> Light
          </button>
          <button className={'theme-seg-btn' + (mode === 'dark' ? ' active' : '')} onClick={() => setMode('dark')}>
            <i className="fa-solid fa-moon"></i> Dark
          </button>
          <button className={'theme-seg-btn' + (mode === 'system' ? ' active' : '')} onClick={() => setMode('system')}>
            <i className="fa-solid fa-display"></i> System
          </button>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '12px', margin: '10px 0 0' }}>
          "System" matches your device's own light/dark setting automatically.
        </p>
      </div>

      <div className="panel section-gap" style={{ maxWidth: '720px' }}>
        <h3>Invoice Numbering</h3>
        <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '-4px 0 16px' }}>Customize how your invoice numbers are generated.</p>
        <div className="grid2">
          <div className="field-sm"><label>Prefix</label><input value={cfg.prefix} onChange={setC('prefix')} placeholder="INV" /></div>
          <div className="field-sm"><label>Middle (optional)</label><input value={cfg.middle} onChange={setC('middle')} placeholder="2026" /></div>
          <div className="field-sm"><label>Separator</label><input value={cfg.separator} onChange={setC('separator')} placeholder="-" maxLength="3" /></div>
          <div className="field-sm"><label>Number Padding</label><input type="number" min="0" max="8" value={cfg.padding} onChange={setC('padding')} /></div>
          <div className="field-sm"><label>Next Number</label><input type="number" min="1" value={cfg.next} onChange={setC('next')} /></div>
        </div>
        <div className="invnum-help">Prefix is required · Middle is optional (year or company code)</div>
        <div className="invnum-preview">Preview: <strong>{preview}</strong></div>
        <div className="invnum-tips">
          <div className="tips-title"><i className="fa-solid fa-lightbulb"></i> Format Tips</div>
          <ul>
            <li><strong>INV</strong> = Invoice — the most common prefix.</li>
            <li>Middle for year: <strong>INV-2026-001</strong> for easy filing.</li>
            <li>Middle for company: <strong>INV-COM-001</strong> (COM = 3-letter company code).</li>
            <li>Leave Middle blank for a simple <strong>INV-001</strong> format.</li>
          </ul>
        </div>
        <button className="btn btn-small btn-orange section-gap" onClick={saveNumbering}>Save Numbering</button>
      </div>

      <div className="panel section-gap" style={{ maxWidth: '720px' }}>
        <h3>Invoice Template</h3>
        <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '-4px 0 16px' }}>Choose a design for your invoices. Applies to preview, PDF, and print.</p>
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <div key={t.id} className={'template-card' + (invoiceTemplate === t.id ? ' selected' : '')} onClick={() => selectTemplate(t.id)}>
              <div className={'template-thumb tpl-thumb-' + t.id} style={t.style}>
                {t.thumb}
              </div>
              <div className="template-name">{t.name} <i className="fa-solid fa-circle-check tpl-check"></i></div>
              <div className="template-desc">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamTab() {
  const { teamMembers, addTeamMember, removeTeamMember, resendInvite } = useData();
  const { toast } = useToast();
  const [f, setF] = useState({ name: '', email: '', role: 'staff' });
  const [lastInvite, setLastInvite] = useState(null); // { email, link }
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // member awaiting confirmation
  const [removing, setRemoving] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const add = async () => {
    if (f.name.trim().length < 1) { toast('Name required', 'Enter the member name.', 'error'); return; }
    if (!isValidEmail(f.email)) { toast('Invalid email', 'Enter a valid email.', 'error'); return; }
    setBusy(true);
    try {
      const res = await addTeamMember({ name: f.name.trim(), email: f.email.trim(), role: f.role });
      setLastInvite({ email: f.email.trim(), link: res?.inviteLink || '' });
      toast('Invitation sent', `${f.name.trim()} must accept the email before they can log in.`);
      setF({ name: '', email: '', role: 'staff' });
    } catch (err) {
      toast('Could not invite', err.message || 'Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const resend = async (m) => {
    try {
      const res = await resendInvite(m._id || m.id);
      if (res?.inviteLink) setLastInvite({ email: m.email, link: res.inviteLink });
      toast('Sent', res?.message || 'Email re-sent.');
    } catch (err) {
      toast('Could not resend', err.message || 'Please try again.', 'error');
    }
  };

  // Step 1: clicking the bin only opens the confirmation dialog.
  const askRemove = (m) => setPendingDelete(m);

  // Step 2: actually delete once confirmed.
  const confirmRemove = async () => {
    const m = pendingDelete;
    if (!m) return;
    const id = m._id || m.id;
    if (!id) {
      toast('Could not remove', 'This member has no ID — refresh the page and try again.', 'error');
      setPendingDelete(null);
      return;
    }
    setRemoving(true);
    try {
      await removeTeamMember(id);
      toast('Member removed', `${m.name}'s access was revoked.`, 'delete');
      setPendingDelete(null);
    } catch (err) {
      console.error('[Invoicify] remove team member failed:', err);
      toast('Could not remove', err.message || 'Please try again.', 'error');
      setPendingDelete(null);
    } finally {
      setRemoving(false);
    }
  };

  const copyLink = async () => {
    if (!lastInvite?.link) return;
    try {
      await navigator.clipboard.writeText(lastInvite.link);
      toast('Copied', 'Invitation link copied to clipboard.');
    } catch {
      toast('Copy failed', 'Select the link and copy it manually.', 'error');
    }
  };

  // 'invited'  = waiting for the member to click Accept in their email
  // 'accepted' = accepted, using the temporary password, hasn't set their own yet
  const statusOf = (m) => {
    if (m.status === 'invited') return { cls: 'ts-invited', icon: 'fa-paper-plane', label: 'Invite sent' };
    if (m.status === 'accepted' || m.mustResetPassword) return { cls: 'ts-pending', icon: 'fa-key', label: 'Password pending' };
    return { cls: 'ts-active', icon: 'fa-circle-check', label: 'Active' };
  };

  return (
    <div className="settings-panel active">
      <div className="panel" style={{ maxWidth: '620px' }}>
        <h3>Invite Team Member</h3>
        <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '-4px 0 16px' }}>
          They'll get an email to accept the invitation. You don't set a password — Invoicify emails them a
          temporary one once they accept.
        </p>
        <div className="grid2">
          <div className="field-sm"><label>Full Name</label><input value={f.name} onChange={set('name')} placeholder="Jane Smith" /></div>
          <div className="field-sm"><label>Email</label><input type="email" value={f.email} onChange={set('email')} placeholder="jane@company.com" /></div>
          <div className="field-sm"><label>Role</label>
            <select value={f.role} onChange={set('role')}>
              <option value="staff">Staff — create &amp; edit</option>
              <option value="worker">Worker — view only</option>
              <option value="auditor">Auditor — view &amp; reports</option>
              <option value="admin">Admin — full control</option>
            </select>
          </div>
        </div>
        <button className="btn btn-small btn-orange" onClick={add} disabled={busy}>
          <i className="fa-solid fa-paper-plane"></i> {busy ? 'Sending…' : 'Send Invitation'}
        </button>

        <div className="team-hint">
          <i className="fa-solid fa-circle-info"></i>
          <span>Accept &rarr; temporary password emailed &rarr; they set their own password on first login.</span>
        </div>

        {lastInvite && (
          <div className="invite-link-box">
            <div className="ilb-title"><i className="fa-solid fa-link"></i> Invitation link for {lastInvite.email}</div>
            <div className="ilb-url">{lastInvite.link}</div>
            <div className="ilb-actions">
              <button className="btn btn-small btn-ghost" onClick={copyLink}><i className="fa-regular fa-copy"></i> Copy link</button>
              <button className="btn btn-small btn-ghost" onClick={() => setLastInvite(null)}>Dismiss</button>
            </div>
            <div className="ilb-note">Share this only if the email didn't arrive — it works once and expires in 7 days.</div>
          </div>
        )}

        <div className="section-gap">
          <h3>Team Members</h3>
          <div className="team-list">
            {teamMembers.length === 0
              ? <p className="empty-line" style={{ fontSize: '13px' }}>No team members yet.</p>
              : teamMembers.map((m) => {
                const st = statusOf(m);
                return (
                  <div className="team-member" key={m.id}>
                    <div className="team-avatar">{(m.name || '?').charAt(0).toUpperCase()}</div>
                    <div className="team-info">
                      <div className="team-name">{m.name}</div>
                      <div className="team-email">{m.email}</div>
                      <div className={'team-status ' + st.cls}><i className={'fa-solid ' + st.icon}></i> {st.label}</div>
                    </div>
                    <span className={'team-role-badge trb-' + m.role}>{ROLE_LABELS[m.role] || m.role}</span>
                    {st.cls !== 'ts-active' && (
                      <button className="team-resend" onClick={() => resend(m)} title="Resend email">
                        <i className="fa-solid fa-rotate-right"></i>
                      </button>
                    )}
                    <button className="team-del" onClick={() => askRemove(m)} title="Remove"><i className="fa-solid fa-trash-can"></i></button>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Remove-member confirmation */}
      <div className={'confirm-overlay' + (pendingDelete ? ' show' : '')}
           onClick={(e) => { if (e.target === e.currentTarget && !removing) setPendingDelete(null); }}>
        <div className="confirm-box">
          <div className="confirm-icon"><i className="fa-solid fa-user-minus"></i></div>
          <h3>Remove {pendingDelete?.name}?</h3>
          <p>
            {pendingDelete?.email} will lose access to this company immediately.
            Invoices and customers they created stay in the account. This can't be undone.
          </p>
          <div className="confirm-actions">
            <button className="btn btn-small" style={{ background: 'var(--danger)', color: '#fff' }}
                    onClick={confirmRemove} disabled={removing}>
              <i className="fa-solid fa-trash-can"></i> {removing ? 'Removing…' : 'Remove'}
            </button>
            <button className="btn btn-small btn-outline" onClick={() => setPendingDelete(null)} disabled={removing}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
