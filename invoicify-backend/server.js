import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import { connectDB } from './config/db.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import quoteRoutes from './routes/quoteRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import cronRoutes from './routes/cronRoutes.js';
import cron from 'node-cron';
import { runMonthlyReportCheck } from './controllers/cronController.js';
import reportsRoutes from './routes/reportsRoutes.js';

// Load environment variables from .env
dotenv.config();

// Connect to the database
connectDB();

const app = express();

// Render (and most cloud hosts) sit behind a reverse proxy — without this,
// req.ip would show the proxy's internal IP instead of the real visitor's,
// which breaks login-activity IP logging (see authController.login).
app.set('trust proxy', true);

// ---- Middleware ----
// Allow the React frontend to talk to this API.
// In development we allow localhost AND local-network IPs (e.g. 192.168.x.x)
// so you can open the app on your phone over the same WiFi.
const allowedOrigin = (origin, callback) => {
  // Requests with no origin (mobile apps, curl, same-origin) are allowed
  if (!origin) return callback(null, true);
  const ok =
    // localhost + local-network IPs (dev / phone on same WiFi)
    /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):\d+$/.test(origin)
    // the configured production frontend
    || origin === process.env.CLIENT_URL
    // any Vercel deployment (production + preview URLs)
    || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
    // any devdom.in subdomain (invoice.devdom.in, api.devdom.in, etc.)
    || /^https:\/\/([a-z0-9-]+\.)?devdom\.in$/i.test(origin);
  callback(null, ok);
};
app.use(cors({ origin: allowedOrigin, credentials: true }));
// Parse JSON request bodies (so req.body works)
app.use(express.json({ limit: '10mb' }));

// ---- Health check route ----
app.get('/', (req, res) => {
  res.json({ message: 'InvoicifysPro API is running 🚀' });
});

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/reports', reportsRoutes);

// ---- 404 handler ----
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});

const PORT = process.env.PORT || 5000;
// Listen on 0.0.0.0 so devices on the same WiFi (your phone) can reach it too.
// Find this machine's LAN IPv4 so the phone URL is ready to copy.
function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

app.listen(PORT, '0.0.0.0', () => {
  const lanIp = getLanIp();
  const emailReady = !!(process.env.SMTP_HOST || process.env.SMTP_USER || process.env.GMAIL_USER || process.env.BREVO_API_KEY);
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║        🧾  I N V O I C I F Y   —   API         ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`   🚀  Server        →  http://localhost:${PORT}`);
  console.log(`   📱  On your phone →  http://${lanIp || '<your-computer-ip>'}:${PORT}`);
  console.log(`   📧  Email         →  ${emailReady ? 'configured ✅' : 'not set (codes log to console)'}`);
  console.log(`   🌱  Environment   →  ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  console.log('   ✨  Ready to roll — happy invoicing!  🎉');
  console.log('');
});

// Runs every day at 10:30 AM IST. No-op except on the last day of the
// month, when it emails each company's monthly CSV report — same logic
// as the manual "Email Report" button uses, just automatic. Runs directly
// on this server now that it's always-on, so no external cron-job.org
// trigger is needed for this one.
cron.schedule('30 10 * * *', async () => {
  try {
    const result = await runMonthlyReportCheck({});
    if (result.sent > 0) {
      console.log(`[InvoicifysPro] Monthly report cron: ${result.message} (sent: ${result.sent})`);
    }
  } catch (err) {
    console.error('[InvoicifysPro] Monthly report cron failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });