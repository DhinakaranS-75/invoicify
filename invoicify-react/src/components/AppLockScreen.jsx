import { useState, useEffect } from 'react';
import { setAppLockPin, verifyAppLockPin } from '../utils/appLock';

// mode="unlock": shown on app open/resume, checks against the saved PIN.
// mode="setup": used from Settings to create a new PIN — asks twice
// (create -> confirm) before saving.
export default function AppLockScreen({ mode = 'unlock', onUnlock, onSetupComplete, onCancel }) {
  const [step, setStep] = useState(mode === 'setup' ? 'create' : 'unlock'); // 'create' | 'confirm' | 'unlock'
  const [digits, setDigits] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (digits.length < 4) return;
    const pin = digits;

    (async () => {
      if (step === 'unlock') {
        const ok = await verifyAppLockPin(pin);
        if (ok) {
          onUnlock();
        } else {
          setError('Incorrect PIN, try again.');
          setShake(true);
          setTimeout(() => { setShake(false); setDigits(''); }, 400);
        }
      } else if (step === 'create') {
        setFirstPin(pin);
        setDigits('');
        setError('');
        setStep('confirm');
      } else if (step === 'confirm') {
        if (pin === firstPin) {
          await setAppLockPin(pin);
          onSetupComplete?.();
        } else {
          setError("PINs didn't match — start again.");
          setShake(true);
          setTimeout(() => {
            setShake(false); setDigits(''); setFirstPin(''); setStep('create');
          }, 500);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  const press = (d) => {
    if (digits.length >= 4) return;
    setError('');
    setDigits((prev) => prev + d);
  };
  const backspace = () => setDigits((prev) => prev.slice(0, -1));

  const titles = { unlock: 'Enter PIN', create: 'Set a PIN', confirm: 'Confirm PIN' };
  const subtitles = {
    unlock: 'Enter your 4-digit PIN to continue',
    create: 'Choose a 4-digit PIN to lock the app',
    confirm: 'Enter the same PIN again'
  };

  return (
    <div className="app-lock-card">
      <div className="app-lock-icon"><i className="fa-solid fa-lock"></i></div>
      <h2>{titles[step]}</h2>
      <p>{subtitles[step]}</p>

      <div className={'applock-dots' + (shake ? ' shake' : '')}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={'applock-dot' + (i < digits.length ? ' filled' : '')} />
        ))}
      </div>

      {error && <div className="applock-error">{error}</div>}

      <div className="applock-keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
          <button key={n} type="button" onClick={() => press(n)}>{n}</button>
        ))}
        <span></span>
        <button type="button" onClick={() => press('0')}>0</button>
        <button type="button" className="applock-backspace" onClick={backspace} aria-label="Backspace">
          <i className="fa-solid fa-delete-left"></i>
        </button>
      </div>

      {mode === 'setup' && onCancel && (
        <button type="button" className="applock-cancel" onClick={onCancel}>Cancel</button>
      )}
    </div>
  );
}
