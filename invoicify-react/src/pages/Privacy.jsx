import { Link } from 'react-router-dom';

// NOTE FOR DHINAKARAN: same as Terms.jsx — fill in the placeholders and get
// a real review before this is treated as your final, live policy.
const LAST_UPDATED = 'August 2026';
const BUSINESS_NAME = 'InvoicifyPro';
const SUPPORT_EMAIL = '[your-support@email.com]';

export default function Privacy() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <Link to="/">
          <img src="/pwa-192x192.png" alt="Invoicify" />
          Invoicify
        </Link>
      </div>

      <div className="legal-body">
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

        <p>
          This Privacy Policy explains what information Invoicify (the "Service"),
          provided by {BUSINESS_NAME}, collects, how we use it, and the choices you have.
        </p>

        <h2>1. Information We Collect</h2>
        <p><strong>Account information</strong> — your name and email address when you sign up.</p>
        <p><strong>Business information</strong> — company name, address, GSTIN, bank details, and logo that you add for your invoices.</p>
        <p><strong>Data you create</strong> — customer records, catalog items, invoices, expenses, and team members you add while using the Service.</p>
        <p><strong>Usage data</strong> — basic technical information like device type and browser, used only to keep the Service working reliably.</p>

        <h2>2. How We Use This Information</h2>
        <ul>
          <li>To provide the core functionality of the Service — creating invoices, tracking payments, managing customers and expenses.</li>
          <li>To authenticate you and keep your account secure.</li>
          <li>To send essential account emails (e.g. password resets, team invitations).</li>
          <li>To diagnose and fix technical issues.</li>
        </ul>
        <p>We do not sell your data, and we do not show ads based on your data.</p>

        <h2>3. Where Your Data Is Stored</h2>
        <p>
          Your data is stored in a MongoDB Atlas database and served through our hosting
          providers. Passwords are stored in encrypted (hashed) form — we never store or
          have access to your plain-text password.
        </p>

        <h2>4. Sharing Your Information</h2>
        <p>We don't sell or rent your personal data. We only share data with:</p>
        <ul>
          <li>Infrastructure providers who host our servers and database, strictly to operate the Service.</li>
          <li>Team members you explicitly invite to your own company account.</li>
          <li>Authorities, if required by law or a valid legal request.</li>
        </ul>

        <h2>5. Your Customers' Data</h2>
        <p>
          When you add your own customers' details to Invoicify to generate invoices, you
          act as the data controller for that information, and you're responsible for
          having a lawful basis to store and use it. We process it only on your behalf, to
          provide the Service to you.
        </p>

        <h2>6. Data Retention</h2>
        <p>
          We retain your account and business data for as long as your account is active.
          If you delete your account, we'll remove your data within a reasonable period,
          except where we're required to retain records for legal or accounting reasons.
        </p>
        <p>
          <strong>Inactive accounts:</strong> If you don't log in to your account for
          <strong> 30 consecutive days</strong>, your account and all associated data —
          including your email, password, mobile number, company details, GSTIN, invoices,
          items/catalog, and expenses — will be <strong>permanently deleted</strong> from
          our systems. Once deleted, this data cannot be recovered. If you attempt to log
          in after this period, you'll be informed that no account exists for that email,
          and you'll need to sign up again as a new user.
        </p>

        <h2>7. Your Rights</h2>
        <p>You can, at any time:</p>
        <ul>
          <li>Access or update your account and business information from within the app.</li>
          <li>Request a copy of your data.</li>
          <li>Request deletion of your account and associated data.</li>
        </ul>
        <p>To exercise these rights, contact us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>

        <h2>8. Cookies & Local Storage</h2>
        <p>
          We use essential cookies/local storage to keep you logged in and remember your
          preferences (like light/dark theme). We don't use third-party advertising or
          tracking cookies.
        </p>

        <h2>9. Children's Privacy</h2>
        <p>
          Invoicify is a business tool and is not directed at, or intended for use by,
          children. We don't knowingly collect information from anyone under 18.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We'll update the "Last
          updated" date above whenever we do. Significant changes will be communicated to
          you directly where appropriate.
        </p>

        <h2>11. Contact Us</h2>
        <p>
          Questions about this Privacy Policy or your data? Reach us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </div>
    </div>
  );
}