import User from '../models/User.js';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import { sendReportEmail } from '../utils/mailer.js';
import { buildReportCsv, isLastDayOfMonth, currentMonthRange } from '../utils/csvReport.js';

// Core logic, shared by:
//  - the HTTP route below (manual/browser trigger, or an external cron
//    service if you ever want a backup trigger)
//  - the in-process daily scheduler in server.js (node-cron), which is the
//    primary way this runs now that the backend lives on your own always-on
//    server — no external cron-job.org dependency needed for this anymore.
//
// No-op every day except the last day of the month, when it actually builds
// and emails each company's CSV report. Safe to call repeatedly.
export async function runMonthlyReportCheck({ forced = false } = {}) {
  const today = new Date();
  if (!forced && !isLastDayOfMonth(today)) {
    return { message: 'Not month-end, nothing to send.', sent: 0, errors: [] };
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

  return { message: `Monthly reports sent for ${monthLabel}.`, sent, errors };
}

// GET /api/cron/send-monthly-reports?key=...
// Kept as a manual/backup trigger (e.g. to test in a browser, or if you
// ever add an external cron service back). The daily automatic check now
// happens via node-cron in server.js instead.
export async function sendMonthlyReports(req, res) {
  try {
    if (req.query.key !== process.env.CRON_SECRET) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const forced = req.query.force === 'true';
    const result = await runMonthlyReportCheck({ forced });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}