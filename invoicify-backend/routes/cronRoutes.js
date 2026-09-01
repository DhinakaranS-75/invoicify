import express from 'express';
import { sendMonthlyReports } from '../controllers/cronController.js';

const router = express.Router();

// No auth middleware here — this is hit by an external cron service, not a
// logged-in user. It's protected by a secret key checked inside the
// controller instead (see CRON_SECRET in .env).
router.get('/send-monthly-reports', sendMonthlyReports);

export default router;
