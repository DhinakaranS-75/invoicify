import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { COUNTRY_PHONE_CODES, isValidEmail } from '../utils/format';

export default function Onboarding() {
  const { currentUser, updateCurrentUser } = useData();
  const { toast } = useToast();
  const [f, setF] = useState({
    companyName: '', email: '', contactCode: '+91', contact: '', address: '', state: '',
    country: 'India', timezone: '', businessType: '', currency: 'INR',
    hasGst: false, gst: '', bankName: '', accountNumber: '', ifsc: '', logo: null
  });
  const [errors, setErrors] = useState({});
  const [shake, setShake] = useState(false);
  const doShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const onCountry = (e) => {
    const country = e.target.value;
    setF((p) => ({ ...p, country, contactCode: COUNTRY_PHONE_CODES[country] || p.contactCode }));
  };

  const onLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setF((p) => ({ ...p, logo: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const finish = async (skip = false) => {
    if (!skip) {
      const errs = {};
      if (f.companyName.trim().length < 2) errs.companyName = 'Please enter your company name.';
      if (f.email.trim() && !isValidEmail(f.email)) errs.email = 'Enter a valid email address.';
      if (Object.keys(errs).length) {
        setErrors(errs);
        doShake();
        toast('Check the form', errs.companyName || errs.email, 'error');
        return;
      }
    }
    setErrors({});
    try {
      await updateCurrentUser({
        onboarded: true,
        company: skip ? { name: currentUser.name + "'s Business", currency: 'INR' } : {
          name: f.companyName, email: f.email, contact: f.contact, contactCode: f.contactCode,
          address: f.address, state: f.state, country: f.country, timezone: f.timezone,
          businessType: f.businessType, currency: f.currency || 'INR',
          gst: f.hasGst ? f.gst : '', bankName: f.bankName, accountNumber: f.accountNumber,
          ifsc: f.ifsc, logo: f.logo
        }
      });
      toast('Welcome aboard', 'Your company profile is set up.');
    } catch (err) {
      toast('Setup failed', err.message || 'Could not save company details.', 'error');
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card wide">
        <h1 className="auth-title" style={{ fontSize: '30px', whiteSpace: 'normal' }}>Company Details</h1>
        <p className="auth-sub" style={{ marginTop: '-10px' }}>One last step — this shows up on every invoice you create.</p>

        <div className="logo-upload">
          <div className="logo-preview">
            {f.logo ? <img src={f.logo} alt="logo" /> : <i className="fa-solid fa-building"></i>}
          </div>
          <div className="logo-upload-text">
            <div className="lu-title">Brand Logo</div>
            <div className="lu-sub">PNG or JPG, optional</div>
          </div>
          <label className="file-btn">
            Upload
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onLogo} />
          </label>
        </div>

        <div className="company-grid">
          <div className={'field-sm' + (shake && errors.companyName ? ' shake' : '')}><label>Company Name</label><input className={errors.companyName ? 'invalid' : ''} value={f.companyName} onChange={set('companyName')} placeholder="Your Company Pvt Ltd" />{errors.companyName && <div className="error-text show">{errors.companyName}</div>}</div>
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
          <div className={'field-sm' + (shake && errors.email ? ' shake' : '')}><label>Company Email</label><input className={errors.email ? 'invalid' : ''} type="email" value={f.email} onChange={set('email')} placeholder="[email protected]" />{errors.email && <div className="error-text show">{errors.email}</div>}</div>
          <div className="field-sm"><label>Address</label><input value={f.address} onChange={set('address')} placeholder="Street, City" /></div>
          <div className="field-sm"><label>State</label><input value={f.state} onChange={set('state')} placeholder="Tamil Nadu" /></div>
          <div className="field-sm">
            <label>Country</label>
            <select value={f.country} onChange={onCountry}>
              {Object.keys(COUNTRY_PHONE_CODES).map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="field-sm">
            <label>Preferred Currency</label>
            <select value={f.currency} onChange={set('currency')}>
              <option value="INR">₹ INR — Indian Rupee</option>
              <option value="USD">$ USD — US Dollar</option>
              <option value="EUR">€ EUR — Euro</option>
              <option value="GBP">£ GBP — British Pound</option>
              <option value="AED">AED — UAE Dirham</option>
              <option value="AUD">$ AUD — Australian Dollar</option>
              <option value="SGD">$ SGD — Singapore Dollar</option>
            </select>
          </div>
        </div>

        <label className="checkbox-row">
          <input type="checkbox" checked={f.hasGst} onChange={(e) => setF((p) => ({ ...p, hasGst: e.target.checked }))} />
          <span>This business is GST registered</span>
        </label>
        {f.hasGst && (
          <div className="field-sm"><label>GST Number</label><input value={f.gst} onChange={set('gst')} placeholder="22AAAAA0000A1Z5" /></div>
        )}

        <div className="section-gap">
          <h3>Bank Details</h3>
          <div className="company-grid">
            <div className="field-sm"><label>Bank Name</label><input value={f.bankName} onChange={set('bankName')} placeholder="Type bank name" /></div>
            <div className="field-sm"><label>Account Number</label><input value={f.accountNumber} onChange={(e) => setF((p) => ({ ...p, accountNumber: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="Type account number" inputMode="numeric" /></div>
            <div className="field-sm"><label>IFSC Code</label><input value={f.ifsc} onChange={set('ifsc')} placeholder="Type IFSC code" /></div>
          </div>
        </div>

        <div className="actions-row">
          <button className="btn btn-teal" onClick={() => finish(false)}>Save &amp; Continue</button>
          <button className="btn btn-outline" onClick={() => finish(true)}>Skip for now</button>
        </div>
      </div>
    </div>
  );
}
