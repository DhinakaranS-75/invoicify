import User from '../models/User.js';
import Invoice from '../models/Invoice.js';
import Quote from '../models/Quote.js';
import Customer from '../models/Customer.js';
import Item from '../models/Item.js';
import Expense from '../models/Expense.js';
import LoginActivity from '../models/LoginActivity.js';
import { sendReportEmail, sendInactivityWarning, sendAccountDeleted } from '../utils/mailer.js';
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

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_DAYS = 7; // buffer AFTER hitting 30 days before actually deleting anything

// Checks every company for inactivity (no team member has logged in) and:
//  - sends a warning email at 15 days, another at 25 days
//  - at 30 days, schedules deletion 7 days out and sends a final notice
//  - once that 7-day grace period passes, permanently deletes all of that
//    company's data and user accounts (re-verifying inactivity right
//    before doing so, in case someone logged in in the meantime)
//
// Flags live on every user in the company (not just one "admin" record),
// and are fully cleared the moment ANY teammate logs back in and brings
// days-inactive below 15 — so a later, brand new inactive streak always
// starts from a clean slate instead of being suppressed by old flags.
export async function runInactivityCheck() {
  const now = new Date();

  // One-time safety migration: a user who predates this feature (or an
  // invited member who's never logged in) won't have lastLoginAt set.
  // Treat "never recorded" as "active as of right now" rather than
  // "infinitely inactive" — otherwise every existing account would look
  // 1000s of days inactive the moment this feature ships and get deleted
  // immediately. Each user only ever hits this once.
  await User.updateMany({ lastLoginAt: { $exists: false } }, { $set: { lastLoginAt: now } });

  const users = await User.find({});
  const byCompany = new Map();
  for (const u of users) {
    if (!u.companyId) continue;
    if (!byCompany.has(u.companyId)) byCompany.set(u.companyId, []);
    byCompany.get(u.companyId).push(u);
  }

  let warned15 = 0, warned25 = 0, scheduled = 0, deleted = 0;
  const errors = [];

  for (const [companyId, teamUsers] of byCompany) {
    try {
      const lastActivityAt = new Date(Math.max(...teamUsers.map((u) => (u.lastLoginAt || u.createdAt).getTime())));
      const daysInactive = Math.floor((now - lastActivityAt) / DAY_MS);
      const userIds = teamUsers.map((u) => u._id);

      // Prefer the admin as the email recipient / "representative" — same
      // convention as runMonthlyReportCheck above.
      const rep = teamUsers.find((u) => u.role === 'admin') || teamUsers[0];
      const companyName = rep.company?.name || 'your company';
      const recipientEmail = rep.company?.email || rep.email;

      if (daysInactive < 15) {
        // Active enough — clear any flags left over from a past inactive
        // streak the team then logged back in from.
        const needsClear = teamUsers.some((u) => u.inactivityWarning15SentAt || u.inactivityWarning25SentAt || u.scheduledDeletionAt);
        if (needsClear) {
          await User.updateMany({ _id: { $in: userIds } }, {
            $unset: { inactivityWarning15SentAt: '', inactivityWarning25SentAt: '', scheduledDeletionAt: '' }
          });
        }
        continue;
      }

      if (daysInactive >= 30) {
        if (rep.scheduledDeletionAt) {
          // Already scheduled during this streak — is the grace period over?
          if (now >= rep.scheduledDeletionAt) {
            // Re-verify right before deleting, in case someone logged in
            // between scheduling and now.
            const fresh = await User.find({ _id: { $in: userIds } });
            const freshLastActivity = new Date(Math.max(...fresh.map((u) => (u.lastLoginAt || u.createdAt).getTime())));
            const freshDaysInactive = Math.floor((now - freshLastActivity) / DAY_MS);

            if (freshDaysInactive >= 30) {
              await Promise.all([
                Invoice.deleteMany({ companyId }),
                Quote.deleteMany({ companyId }),
                Customer.deleteMany({ companyId }),
                Item.deleteMany({ companyId }),
                Expense.deleteMany({ companyId }),
                LoginActivity.deleteMany({ userId: { $in: userIds } })
              ]);
              for (const u of fresh) {
                sendAccountDeleted(u.email, u.name, true).catch((e) => console.error('sendAccountDeleted failed:', e.message));
              }
              await User.deleteMany({ companyId });
              deleted += 1;
            }
            // else: someone logged back in — the < 15 branch above will
            // clear the stale schedule on the next run automatically.
          }
          // else: still within the grace period, nothing to do yet.
        } else {
          // Just crossed 30 days for the first time this streak.
          const scheduledFor = new Date(now.getTime() + GRACE_DAYS * DAY_MS);
          await User.updateMany({ _id: { $in: userIds } }, { $set: { scheduledDeletionAt: scheduledFor } });
          await sendInactivityWarning({ email: recipientEmail, name: rep.name, companyName, daysInactive, daysLeft: GRACE_DAYS, isFinal: true });
          scheduled += 1;
        }
      } else if (daysInactive >= 25 && !rep.inactivityWarning25SentAt) {
        await User.updateMany({ _id: { $in: userIds } }, { $set: { inactivityWarning25SentAt: now } });
        await sendInactivityWarning({ email: recipientEmail, name: rep.name, companyName, daysInactive, daysLeft: 30 - daysInactive, isFinal: false });
        warned25 += 1;
      } else if (daysInactive >= 15 && !rep.inactivityWarning15SentAt) {
        await User.updateMany({ _id: { $in: userIds } }, { $set: { inactivityWarning15SentAt: now } });
        await sendInactivityWarning({ email: recipientEmail, name: rep.name, companyName, daysInactive, daysLeft: 30 - daysInactive, isFinal: false });
        warned15 += 1;
      }
    } catch (err) {
      errors.push({ companyId, message: err.message });
    }
  }

  return { message: 'Inactivity check complete.', warned15, warned25, scheduled, deleted, errors };
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

// GET /api/cron/check-inactive-accounts?key=...
// Manual/backup trigger for runInactivityCheck — same CRON_SECRET pattern
// as the monthly report route above. The daily automatic run happens via
// node-cron in server.js.
export async function checkInactiveAccounts(req, res) {
  try {
    if (req.query.key !== process.env.CRON_SECRET) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const result = await runInactivityCheck();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
