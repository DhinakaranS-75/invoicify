import nodemailer from 'nodemailer';

// Provider-agnostic SMTP — works with Gmail, Yahoo, or any SMTP host.
// Configure in .env (see .env.example for Gmail / Yahoo examples):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, [SMTP_FROM]
// Back-compat: if only GMAIL_USER / GMAIL_APP_PASSWORD are set, Gmail is used.
// Note: personal Outlook/Hotmail no longer supports app-password SMTP
// (Microsoft disabled Basic Auth for SMTP in 2026) — use Gmail or Yahoo.
//
// IMPORTANT: env vars are read lazily inside getTransporter() — NOT at module
// load time — so this works even if dotenv.config() runs after this file is
// imported (a common ES-module load-order gotcha).

let transporter = null;
let initialized = false;

function getTransporter() {
  if (initialized) return transporter;
  initialized = true;

  const host = process.env.SMTP_HOST || (process.env.GMAIL_USER ? 'smtp.gmail.com' : '');
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER || '';
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = SSL, 587 = STARTTLS
      auth: { user, pass }
    });
  }
  return transporter;
}

export async function sendResetOtp(email, otp) {
  const t = getTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || 'no-reply@invoicify';

  const subject = 'Your Invoicify password reset code';
  const text = `Your Invoicify password reset code is ${otp}. It expires in 10 minutes. If you didn't request this, you can safely ignore this email.`;
  const html = `
  <div style="background:#f4f4fb;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(27,28,51,.10);">
      <div style="height:6px;background:linear-gradient(90deg,#2b2f77 0 55%,#f2703c 55% 78%,#17b3a3 78% 100%);"></div>
      <div style="padding:32px 30px 28px;">
        <div style="font-size:24px;font-weight:800;color:#2b2f77;letter-spacing:.5px;margin:0 0 4px;">Invoicify</div>
        <div style="font-size:15px;font-weight:700;color:#2b2f77;margin:18px 0 6px;">Reset your password</div>
        <p style="font-size:14px;color:#555;line-height:1.55;margin:0 0 22px;">Use the verification code below to set a new password. This code expires in <strong>10 minutes</strong>.</p>
        <div style="background:#f4f4fb;border:1px solid #e6e6f2;border-radius:14px;padding:18px;text-align:center;margin:0 0 22px;">
          <div style="font-size:36px;font-weight:800;letter-spacing:12px;color:#2b2f77;padding-left:12px;">${otp}</div>
        </div>
        <p style="font-size:12.5px;color:#999;line-height:1.5;margin:0;">If you didn't request a password reset, you can safely ignore this email — your account is still secure.</p>
      </div>
      <div style="background:#fafafe;border-top:1px solid #eee;padding:16px 30px;text-align:center;">
        <div style="font-size:12px;color:#aaa;">Sent by Invoicify · This is an automated message, please don't reply.</div>
      </div>
    </div>
  </div>`;

  // No SMTP configured → log to console so development/testing still works.
  if (!t) {
    console.log(`\n============================================================`);
    console.log(`[Invoicify] Email not configured (set SMTP_* or GMAIL_* in .env).`);
    console.log(`Password reset code for ${email}: ${otp}  (valid 10 min)`);
    console.log(`============================================================\n`);
    return;
  }

  await t.sendMail({
    from: `"Invoicify" <${fromAddress}>`,
    to: email,
    subject,
    text,
    html
  });
  console.log(`[Invoicify] Reset code emailed to ${email}`);
}

export async function sendAccountDeleted(email, name, dataDeleted) {
  const t = getTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || 'no-reply@invoicify';
  const subject = 'Your Invoicify account has been deleted';
  const dataLine = dataDeleted
    ? 'All your invoices, customers and items have been permanently deleted along with your account.'
    : 'Your account has been deleted. Any business data you shared with team members may still exist under your company.';
  const text = `Hi ${name || 'there'}, your Invoicify account has been deleted. ${dataLine} If this wasn't you, please contact support immediately.`;
  const html = `
  <div style="background:#f4f4fb;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(27,28,51,.10);">
      <div style="height:6px;background:linear-gradient(90deg,#2b2f77 0 55%,#f2703c 55% 78%,#17b3a3 78% 100%);"></div>
      <div style="padding:32px 30px 28px;">
        <div style="font-size:24px;font-weight:800;color:#2b2f77;margin:0 0 4px;">Invoicify</div>
        <div style="font-size:15px;font-weight:700;color:#2b2f77;margin:18px 0 6px;">Your account has been deleted</div>
        <p style="font-size:14px;color:#555;line-height:1.55;margin:0 0 16px;">Hi ${name || 'there'}, we're confirming that your Invoicify account has been closed. ${dataLine}</p>
        <p style="font-size:13px;color:#999;line-height:1.5;margin:0;">If you didn't request this, please contact support right away. We're sorry to see you go.</p>
      </div>
    </div>
  </div>`;

  if (!t) {
    console.log(`[Invoicify] Account deleted for ${email} (email not configured).`);
    return;
  }
  await t.sendMail({ from: `"Invoicify" <${fromAddress}>`, to: email, subject, text, html });
  console.log(`[Invoicify] Account-deleted email sent to ${email}`);
}
