import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

/**
 * First-run checklist shown on Home for new users, instead of the dashboard.
 * Each step's completion is derived from real data; when all are done the
 * parent (Home) switches to the dashboard automatically.
 */
export default function GettingStarted({ onSkip }) {
  const navigate = useNavigate();
  const { currentUser, invoices, customers, catalogItems } = useData();
  const company = currentUser?.company || {};
  const firstName = (currentUser?.firstName || currentUser?.name || 'there').split(' ')[0];

  const companyDone = !!(company.address || company.contact || company.email || company.bankName);
  const templateDone = !!localStorage.getItem('iv_onboard_tmpl') || invoices.length > 0;
  const customerDone = customers.length > 0;
  const itemDone = catalogItems.length > 0;
  const invoiceDone = invoices.length > 0;

  const steps = [
    { icon: 'fa-building', title: 'Set up your company', desc: 'Add your name, contact, address and bank details — they appear on every invoice.', done: companyDone, cta: 'Set up', go: () => navigate('/settings', { state: { tab: 'company' } }) },
    { icon: 'fa-palette', title: 'Pick an invoice template', desc: 'Choose from 9 designs that match your brand.', done: templateDone, cta: 'Choose', go: () => navigate('/settings', { state: { tab: 'preferences' } }) },
    { icon: 'fa-users', title: 'Add your first customer', desc: 'Save a customer once, then reuse them on any invoice.', done: customerDone, cta: 'Add customer', go: () => navigate('/customers') },
    { icon: 'fa-box', title: 'Add your first item', desc: 'Build a catalog of products or services you bill for.', done: itemDone, cta: 'Add item', go: () => navigate('/items') },
    { icon: 'fa-file-invoice', title: 'Create your first invoice', desc: 'Put it all together and generate a professional invoice.', done: invoiceDone, cta: 'Create invoice', go: () => navigate('/invoices') }
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="page active">
      <div className="gs-wrap">
        <div className="gs-header">
          <h1>Welcome to InvoicifysPro, {firstName} 👋</h1>
          <p>Let's get you set up. Complete these steps to start invoicing like a pro.</p>
        </div>

        <div className="gs-progress-card">
          <div className="gs-progress-top">
            <span className="gs-progress-label">{doneCount} of {steps.length} complete</span>
            <span className="gs-progress-pct">{pct}%</span>
          </div>
          <div className="gs-progress-track"><div className="gs-progress-fill" style={{ width: pct + '%' }}></div></div>
        </div>

        <div className="gs-steps">
          {steps.map((s, i) => (
            <div key={i} className={'gs-step' + (s.done ? ' done' : '')}>
              <div className="gs-step-icon">
                {s.done ? <i className="fa-solid fa-check"></i> : <i className={'fa-solid ' + s.icon}></i>}
              </div>
              <div className="gs-step-body">
                <div className="gs-step-title">{s.title}</div>
                <div className="gs-step-desc">{s.desc}</div>
              </div>
              {s.done
                ? <span className="gs-step-status">Done</span>
                : <button className="btn btn-small btn-orange" onClick={s.go}>{s.cta}</button>}
            </div>
          ))}
        </div>

        <div className="gs-skip">
          <a onClick={onSkip}>Skip for now — go to dashboard</a>
        </div>
      </div>
    </div>
  );
}