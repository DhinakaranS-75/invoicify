import User from '../models/User.js';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import { sendReportEmail } from '../utils/mailer.js';
import { buildReportCsv, isLastDayOfMonth, currentMonthRange } from '../utils/csvReport.js';

// GET /api/cron/send-monthly-reports?key=...
// Meant to be hit once a day by an external cron service (e.g. cron-job.org) —
// it's a no-op every day except the last day of the month, when it actually
// builds and emails each company's CSV report. Safe to call repeatedly.
export async function sendMonthlyReports(req, res) {
  try {
    if (req.query.key !== process.env.CRON_SECRET) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const today = new Date();
    const forced = req.query.force === 'true';
    if (!forced && !isLastDayOfMonth(today)) {
      return res.json({ message: 'Not month-end, nothing to send. Add &force=true to test.', sent: 0 });
    }

    const { start, end, monthLabel } = currentMonthRange(today);

    // Team members share a companyId and each carry their own copy of the
    // company sub-document, so group by companyId and pick one recipient
    // per company (preferring the admin) to avoid emailing the same report
    // once per team member.
    const users = await User.find({ 'company.email': { $exists: true, $ne: '' } });
    const byCompany = new Map();
    for (const u of users) {
      if (!u.companyId) continue;
      const existing = byCompany.get(u.companyId);
      if (!existing || (u.role === 'admin' && existing.role !== 'admin')) {
        byCompany.set(u.companyId, u);
      }
    }

    let sent = 0;
    const errors = [];

    for (const [companyId, user] of byCompany) {
      try {
        const [invoices, expenses] = await Promise.all([
          Invoice.find({ companyId, date: { $gte: start, $lte: end } }).sort({ date: 1 }),
          Expense.find({ companyId, date: { $gte: start, $lte: end } }).sort({ date: 1 })
        ]);

        const csvContent = buildReportCsv({
          label: monthLabel,
          companyName: user.company?.name || 'Your company',
          invoices,
          expenses
        });

        await sendReportEmail({
          email: user.company.email,
          name: user.name,
          companyName: user.company?.name || 'Your company',
          label: monthLabel,
          csvContent
        });
        sent += 1;
      } catch (err) {
        errors.push({ companyId, message: err.message });
      }
    }

    res.json({ message: `Monthly reports sent for ${monthLabel}.`, sent, errors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
