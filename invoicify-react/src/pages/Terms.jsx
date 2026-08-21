import { Link } from 'react-router-dom';

// NOTE FOR DHINAKARAN: fill in the bracketed placeholders (business name,
// contact email, address, jurisdiction) before this goes live, and have a
// lawyer review it once the business is registered — this is a solid
// starting template, not a substitute for real legal advice.
const LAST_UPDATED = 'August 2026';
const BUSINESS_NAME = 'InvoicifyPro';
const SUPPORT_EMAIL = '[your-support@email.com]';
const JURISDICTION = 'India';

export default function Terms() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <Link to="/">
          <img src="/pwa-192x192.png" alt="Invoicify" />
          Invoicify
        </Link>
      </div>

      <div className="legal-body">
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

        <p>
          These Terms of Service ("Terms") govern your access to and use of Invoicify
          (the "Service"), provided by {BUSINESS_NAME} ("we", "us", "our"). By creating
          an account or using the Service, you agree to these Terms. If you don't agree,
          please don't use the Service.
        </p>

        <h2>1. What Invoicify Is</h2>
        <p>
          Invoicify is a billing and invoicing tool that lets you create invoices, manage
          customers and items, record expenses, and track payments for your own business.
          It is provided as a tool for your convenience — you remain solely responsible
          for the accuracy of the invoices, tax details (including GST), and financial
          records you create using it.
        </p>

        <h2>2. Your Account</h2>
        <ul>
          <li>You must provide accurate information when registering and keep your password secure.</li>
          <li>You're responsible for all activity that happens under your account, including actions by team members you invite.</li>
          <li>You must be legally able to enter into a contract to use the Service.</li>
          <li>Notify us immediately if you suspect unauthorised access to your account.</li>
        </ul>

        <h2>3. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose, including tax evasion or issuing fraudulent invoices.</li>
          <li>Attempt to gain unauthorised access to other accounts or to our systems.</li>
          <li>Upload malicious code, or interfere with the Service's normal operation.</li>
          <li>Resell or sublicense the Service without our written permission.</li>
        </ul>

        <h2>4. Your Data & Content</h2>
        <p>
          You own the invoices, customer records, expenses, and other business data you
          enter into Invoicify ("Your Content"). We don't claim ownership over it. You're
          responsible for making sure Your Content is accurate and that you have the right
          to store and use it (for example, customer details you've collected lawfully).
        </p>
        <p>
          You grant us a limited licence to store, process, and display Your Content
          solely to operate and improve the Service for you (for example, generating a
          PDF from your invoice data).
        </p>

        <h2>5. Fees</h2>
        <p>
          Invoicify is currently offered free of charge. If we introduce paid plans in the
          future, we'll clearly communicate pricing and give notice before any changes
          affect your existing account.
        </p>

        <h2>6. Third-Party Services</h2>
        <p>
          The Service relies on third-party infrastructure providers (for hosting,
          database storage, and, where applicable, payment processing) to operate. We
          choose reputable providers, but we aren't responsible for outages or issues
          caused by those third parties that are outside our control.
        </p>

        <h2>7. Disclaimer of Warranties</h2>
        <p>
          The Service is provided "as is" and "as available," without warranties of any
          kind, express or implied. We don't guarantee the Service will be uninterrupted,
          error-free, or that it complies with every tax regulation applicable to your
          business — you should verify GST and other statutory requirements independently
          or with a qualified professional.
        </p>

        <h2>8. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, {BUSINESS_NAME} will not be liable for
          any indirect, incidental, or consequential damages arising from your use of the
          Service, including loss of business data, revenue, or profits, even if we've
          been advised of the possibility of such damages.
        </p>

        <h2>9. Termination</h2>
        <p>
          You may stop using the Service and delete your account at any time. We may
          suspend or terminate accounts that violate these Terms, or that we reasonably
          believe are being used for fraudulent or illegal activity.
        </p>
        <p>
          <strong>Automatic deletion for inactivity:</strong> To protect your data and
          keep our systems secure, any account that has not been logged into for{' '}
          <strong>30 consecutive days</strong> will be considered inactive, and all data
          associated with it — including your email, password, mobile number, company
          details, GSTIN, invoices, items, and expenses — will be{' '}
          <strong>permanently and irreversibly deleted</strong>. If you try to log in
          after this period, you'll be told that no account exists, and you'll need to
          sign up again as a new user. We recommend logging in at least once every 30
          days if you'd like to keep using your account and data.
        </p>

        <h2>10. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. We'll update the "Last updated"
          date above when we do. Continued use of the Service after changes means you
          accept the updated Terms.
        </p>

        <h2>11. Governing Law</h2>
        <p>
          These Terms are governed by the laws of {JURISDICTION}, without regard to its
          conflict of law principles.
        </p>

        <h2>12. Contact</h2>
        <p>
          Questions about these Terms? Reach us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </div>
    </div>
  );
}