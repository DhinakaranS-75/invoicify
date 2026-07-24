import { useState, useEffect } from 'react';

const DISMISS_KEY = 'invoicify_install_dismissed';

// Small banner offering to install Invoicify to the home screen.
//
// Chrome/Edge fire `beforeinstallprompt` when the app qualifies (HTTPS,
// manifest, service worker). iOS Safari never fires it, so there we show
// the manual "Share -> Add to Home Screen" instructions instead.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Already installed and running standalone? Nothing to offer.
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (standalone) return undefined;

    // Respect a previous dismissal for 30 days.
    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (until && Date.now() < until) return undefined;
    } catch {
      // localStorage blocked (private mode) — just carry on.
    }

    const onPrompt = (e) => {
      e.preventDefault();       // stop Chrome's own mini-infobar
      setDeferred(e);
      setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const onInstalled = () => { setHidden(true); setDeferred(null); };
    window.addEventListener('appinstalled', onInstalled);

    // iOS: no install event exists, so detect Safari on iOS and hint.
    const ua = window.navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos && isSafari) {
      setShowIosHint(true);
      setHidden(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    } catch {
      // ignore
    }
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      // user closed the dialog — nothing to do
    }
    setDeferred(null);
    setHidden(true);
  };

  if (hidden || (!deferred && !showIosHint)) return null;

  return (
    <div className="install-banner">
      <div className="ib-icon"><i className="fa-solid fa-mobile-screen-button"></i></div>
      <div className="ib-text">
        <strong>Install Invoicify</strong>
        {showIosHint
          ? <span>Tap Share <i className="fa-solid fa-arrow-up-from-bracket"></i> then "Add to Home Screen".</span>
          : <span>Add it to your home screen — opens fullscreen, just like an app.</span>}
      </div>
      {!showIosHint && (
        <button className="btn btn-small btn-orange ib-cta" onClick={install}>Install</button>
      )}
      <button className="ib-close" onClick={dismiss} title="Not now">
        <i className="fa-solid fa-xmark"></i>
      </button>
    </div>
  );
}
