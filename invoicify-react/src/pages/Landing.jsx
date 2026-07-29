import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

// ---------------------------------------------------------------------------
// "Try live demo" logs into a shared demo account so visitors can look around
// without signing up. Create this account once (normal sign-up), complete its
// onboarding, and seed it with a few nice-looking invoices/customers.
// Then fill the two values below. Leaving them blank hides the demo button.
//
// Note: it's a SHARED account — anyone can edit its data. That's fine for a
// quick look; making it tamper-proof (read-only or nightly reset) is a small
// backend follow-up we can add later.
// ---------------------------------------------------------------------------
const DEMO_EMAIL = '';      // e.g. 'demo@invoicify.app'
const DEMO_PASSWORD = '';   // e.g. 'demo1234'

const FEATURES = [
  { icon: 'fa-bolt', title: 'Invoices in seconds', text: 'Pick a template, add items, done. Nine professional designs, GST-ready out of the box.' },
  { icon: 'fa-address-book', title: 'Customers & items', text: 'Save customers and products once, reuse them on every invoice. No retyping.' },
  { icon: 'fa-indian-rupee-sign', title: 'Payments & balances', text: 'Record part-payments, watch balances update, and never lose track of who owes what.' },
  { icon: 'fa-users', title: 'Invite your team', text: 'Add staff with the right access. They join by email invite — you never handle passwords.' },
  { icon: 'fa-chart-pie', title: 'Reports that make sense', text: 'Income by month, by payment method, outstanding dues — your numbers at a glance.' },
  { icon: 'fa-mobile-screen-button', title: 'Installs like an app', text: 'Add it to your phone’s home screen and open it fullscreen. Works on any device.' }
];

const STEPS = [
  { n: '1', title: 'Set up your company', text: 'Add your name, logo and bank details once — they appear on every invoice.' },
  { n: '2', title: 'Create an invoice', text: 'Choose a template, pick your customer and items, and preview instantly.' },
  { n: '3', title: 'Send & get paid', text: 'Download or print, mark it sent, and record the payment when it lands.' }
];

export default function Landing() {
  const navigate = useNavigate();
  const { login } = useData();
  const { toast } = useToast();

  const goSignup = () => navigate('/signup');
  const goLogin = () => navigate('/login');

  const tryDemo = async () => {
    if (!DEMO_EMAIL || !DEMO_PASSWORD) { navigate('/signup'); return; }
    try {
      await login(DEMO_EMAIL, DEMO_PASSWORD);
      navigate('/home', { replace: true });
      toast('Welcome to the demo', 'Have a look around — this is sample data.');
    } catch {
      toast('Demo unavailable', 'Please sign up for a free account instead.', 'error');
      navigate('/signup');
    }
  };

  const showDemo = Boolean(DEMO_EMAIL && DEMO_PASSWORD);

  return (
    <div className="lp">
      {/* ---- Top bar ---- */}
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <div className="lp-brand">
            <span className="lp-brand-mark"><i className="fa-solid fa-file-invoice-dollar"></i></span>
            <span className="lp-brand-name">Invoicify</span>
          </div>
          <nav className="lp-nav-links">
            <a href="#features" className="lp-nav-link">Features</a>
            <a href="#how" className="lp-nav-link">How it works</a>
            <button className="lp-link-btn" onClick={goLogin}>Log in</button>
            <button className="btn btn-orange lp-nav-cta" onClick={goSignup}>Sign up free</button>
          </nav>
        </div>
      </header>

      {/* ---- Hero ---- */}
      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">GST-ready · Free to start</span>
            <h1 className="lp-h1">Invoices your customers<br /><span className="lp-h1-accent">take seriously.</span></h1>
            <p className="lp-sub">
              Create clean, professional invoices in seconds — track payments, manage customers,
              and run your billing from anywhere. Built for shops, freelancers and small teams.
            </p>
            <div className="lp-cta-row">
              <button className="btn btn-orange lp-cta" onClick={goSignup}>Start free</button>
              {showDemo
                ? <button className="btn btn-outline lp-cta" onClick={tryDemo}>Try live demo</button>
                : <button className="btn btn-outline lp-cta" onClick={goLogin}>I already have an account</button>}
            </div>
            <p className="lp-trust"><i className="fa-solid fa-circle-check"></i> No credit card &nbsp;·&nbsp; Free forever plan &nbsp;·&nbsp; Your data stays yours</p>
          </div>

          {/* Product mockup — pure CSS, no image */}
          <div className="lp-hero-art" aria-hidden="true">
            <div className="lp-mock">
              <div className="lp-mock-band"></div>
              <div className="lp-mock-head">
                <div>
                  <div className="lp-mock-title">INVOICE</div>
                  <div className="lp-mock-muted">INV-0042</div>
                </div>
                <div className="lp-mock-logo"><i className="fa-solid fa-file-invoice-dollar"></i></div>
              </div>
              <div className="lp-mock-rows">
                <div className="lp-mock-row"><span className="lp-l w60"></span><span className="lp-l w20"></span></div>
                <div className="lp-mock-row"><span className="lp-l w45"></span><span className="lp-l w20"></span></div>
                <div className="lp-mock-row"><span className="lp-l w55"></span><span className="lp-l w20"></span></div>
              </div>
              <div className="lp-mock-total">
                <span>Total</span><strong>₹ 18,900</strong>
              </div>
              <div className="lp-mock-badge">Paid</div>
            </div>
            <div className="lp-blob lp-blob-1"></div>
            <div className="lp-blob lp-blob-2"></div>
          </div>
        </div>
      </section>

      {/* ---- Features ---- */}
      <section className="lp-section" id="features">
        <div className="lp-wrap">
          <div className="lp-section-head">
            <h2 className="lp-h2">Everything you need to bill with confidence</h2>
            <p className="lp-section-sub">No clutter, no learning curve — just the tools that get invoices out the door.</p>
          </div>
          <div className="lp-feature-grid">
            {FEATURES.map((f) => (
              <div className="lp-feature" key={f.title}>
                <div className="lp-feature-icon"><i className={'fa-solid ' + f.icon}></i></div>
                <h3 className="lp-feature-title">{f.title}</h3>
                <p className="lp-feature-text">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className="lp-section lp-section-alt" id="how">
        <div className="lp-wrap">
          <div className="lp-section-head">
            <h2 className="lp-h2">Up and running in three steps</h2>
            <p className="lp-section-sub">From sign-up to your first sent invoice in a few minutes.</p>
          </div>
          <div className="lp-steps">
            {STEPS.map((s) => (
              <div className="lp-step" key={s.n}>
                <div className="lp-step-num">{s.n}</div>
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-text">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Final CTA ---- */}
      <section className="lp-final">
        <div className="lp-wrap lp-final-inner">
          <h2 className="lp-final-h">Ready to send your first invoice?</h2>
          <p className="lp-final-sub">It’s free to start — no card, no commitment.</p>
          <div className="lp-cta-row lp-final-cta">
            <button className="btn btn-orange lp-cta" onClick={goSignup}>Create free account</button>
            {showDemo && <button className="btn btn-ghost-light lp-cta" onClick={tryDemo}>Try the demo</button>}
          </div>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <div className="lp-brand">
            <span className="lp-brand-mark"><i className="fa-solid fa-file-invoice-dollar"></i></span>
            <span className="lp-brand-name">Invoicify</span>
          </div>
          <div className="lp-footer-links">
            <button className="lp-link-btn" onClick={goLogin}>Log in</button>
            <button className="lp-link-btn" onClick={goSignup}>Sign up</button>
            <a href="#features" className="lp-nav-link">Features</a>
          </div>
          {/* Change this to your name / brand */}
          <div className="lp-footer-credit">Built by Dhinakaran · © {new Date().getFullYear()} Invoicify</div>
        </div>
      </footer>
    </div>
  );
}
