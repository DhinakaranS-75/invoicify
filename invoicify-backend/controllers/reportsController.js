import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import { sendReportEmail } from '../utils/mailer.js';
import { buildReportCsv } from '../utils/csvReport.js';

// POST /api/reports/email
// Body: { start, end, label } — the date range and display label currently
// selected on the Reports page. Sent (via the already-logged-in user's own
// session) to that company's designated email, on demand.
export async function emailReport(req, res) {
  try {
    const { start, end, label } = req.body;
    if (!start || !end) {
      return res.status(400).json({ message: 'start and end dates are required.' });
    }

    const companyEmail = req.user.company?.email;
    if (!companyEmail) {
      return res.status(400).json({ message: 'Add a company email in Settings → Company Details before emailing a report.' });
    }

    const companyId = req.user.companyId;
    const [invoices, expenses] = await Promise.all([
      Invoice.find({ companyId, date: { $gte: start, $lte: end } }).sort({ date: 1 }),
      Expense.find({ companyId, date: { $gte: start, $lte: end } }).sort({ date: 1 })
    ]);

    const csvContent = buildReportCsv({
      label: label || `${start} to ${end}`,
      companyName: req.user.company?.name || 'Your company',
      invoices,
      expenses
    });

    await sendReportEmail({
      email: companyEmail,
      name: req.user.name,
      companyName: req.user.company?.name || 'Your company',
      label: label || `${start} to ${end}`,
      csvContent
    });

    res.json({ message: `Report sent to ${companyEmail}.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
