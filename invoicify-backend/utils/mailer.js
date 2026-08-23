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

export async function sendEmailVerifyOtp(email, otp) {
  const t = getTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || 'no-reply@invoicify';

  const subject = 'Verify your Invoicify email';
  const text = `Your Invoicify email verification code is ${otp}. It expires in 10 minutes. If you didn't request this, you can safely ignore this email.`;
  const html = `
  <div style="background:#f4f4fb;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(27,28,51,.10);">
      <div style="height:6px;background:linear-gradient(90deg,#2b2f77 0 55%,#f2703c 55% 78%,#17b3a3 78% 100%);"></div>
      <div style="padding:32px 30px 28px;">
        <div style="font-size:24px;font-weight:800;color:#2b2f77;letter-spacing:.5px;margin:0 0 4px;">Invoicify</div>
        <div style="font-size:15px;font-weight:700;color:#2b2f77;margin:18px 0 6px;">Verify your email</div>
        <p style="font-size:14px;color:#555;line-height:1.55;margin:0 0 22px;">Enter the code below in Invoicify to confirm this is your email address. This code expires in <strong>10 minutes</strong>.</p>
        <div style="background:#f4f4fb;border:1px solid #e6e6f2;border-radius:14px;padding:18px;text-align:center;margin:0 0 22px;">
          <div style="font-size:36px;font-weight:800;letter-spacing:12px;color:#2b2f77;padding-left:12px;">${otp}</div>
        </div>
        <p style="font-size:12.5px;color:#999;line-height:1.5;margin:0;">If you didn't request this, you can safely ignore this email.</p>
      </div>
      <div style="background:#fafafe;border-top:1px solid #eee;padding:16px 30px;text-align:center;">
        <div style="font-size:12px;color:#aaa;">Sent by Invoicify · This is an automated message, please don't reply.</div>
      </div>
    </div>
  </div>`;

  if (!t) {
    console.log(`\n============================================================`);
    console.log(`[Invoicify] Email not configured (set SMTP_* or GMAIL_* in .env).`);
    console.log(`Email verification code for ${email}: ${otp}  (valid 10 min)`);
    console.log(`============================================================\n`);
    return;
  }

  await t.sendMail({ from: `"Invoicify" <${fromAddress}>`, to: email, subject, text, html });
  console.log(`[Invoicify] Email-verify code emailed to ${email}`);
}

// Shared branded wrapper so every Invoicify email looks the same.
function shell(innerHtml) {
  return `
  <div style="background:#f4f4fb;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(27,28,51,.10);">
      <div style="height:6px;background:linear-gradient(90deg,#2b2f77 0 55%,#f2703c 55% 78%,#17b3a3 78% 100%);"></div>
      <div style="padding:32px 30px 28px;">
        <div style="font-size:24px;font-weight:800;color:#2b2f77;letter-spacing:.5px;margin:0 0 4px;">Invoicify</div>
        ${innerHtml}
      </div>
      <div style="background:#fafafe;border-top:1px solid #eee;padding:16px 30px;text-align:center;">
        <div style="font-size:12px;color:#aaa;">Sent by Invoicify · This is an automated message, please don't reply.</div>
      </div>
    </div>
  </div>`;
}

const ROLE_TEXT = {
  admin: 'Admin — full control',
  staff: 'Staff — create & edit',
  worker: 'Worker — view only',
  auditor: 'Auditor — view & reports'
};

// STEP 1 of the team flow: "you've been invited, click to accept".
// Until this link is clicked the member CANNOT log in.
export async function sendTeamInvite({ email, name, role, companyName, invitedBy, link }) {
  const t = getTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || 'no-reply@invoicify';
  const org = companyName || 'their company';
  const roleLine = ROLE_TEXT[role] || role;

  const subject = `You've been invited to join ${org} on Invoicify`;
  const text = `Hi ${name || 'there'}, ${invitedBy || 'an admin'} invited you to join ${org} on Invoicify as ${roleLine}. Accept your invitation here: ${link}\n\nThis link expires in 7 days. Once you accept, we'll email you a temporary password to log in with.`;
  const html = shell(`
        <div style="font-size:15px;font-weight:700;color:#2b2f77;margin:18px 0 6px;">You're invited to join ${org}</div>
        <p style="font-size:14px;color:#555;line-height:1.55;margin:0 0 18px;">Hi ${name || 'there'}, <strong>${invitedBy || 'an admin'}</strong> has invited you to join <strong>${org}</strong> on Invoicify.</p>
        <div style="background:#f4f4fb;border:1px solid #e6e6f2;border-radius:12px;padding:14px 16px;margin:0 0 22px;">
          <div style="font-size:12px;color:#999;margin-bottom:4px;">YOUR ROLE</div>
          <div style="font-size:14px;font-weight:700;color:#2b2f77;">${roleLine}</div>
        </div>
        <div style="text-align:center;margin:0 0 22px;">
          <a href="${link}" style="display:inline-block;background:#f2703c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 34px;border-radius:10px;">Accept Invitation</a>
        </div>
        <p style="font-size:13px;color:#555;line-height:1.55;margin:0 0 14px;">Once you accept, we'll email you a <strong>temporary password</strong>. Use it to log in and you'll be asked to choose your own password straight away.</p>
        <p style="font-size:12px;color:#999;line-height:1.5;margin:0 0 6px;">This invitation expires in 7 days. If the button doesn't work, copy this link into your browser:</p>
        <p style="font-size:11.5px;color:#8a8ab0;word-break:break-all;margin:0;">${link}</p>`);

  if (!t) {
    console.log(`\n============================================================`);
    console.log(`[Invoicify] Email not configured (set SMTP_* in .env).`);
    console.log(`Invitation for ${email} — accept link:`);
    console.log(link);
    console.log(`============================================================\n`);
    return;
  }
  await t.sendMail({ from: `"Invoicify" <${fromAddress}>`, to: email, subject, text, html });
  console.log(`[Invoicify] Invitation emailed to ${email}`);
}

// STEP 2 of the team flow: invite accepted -> send the temporary password.
// Logging in with it does NOT sign them in; it forces the set-password screen.
export async function sendTempPassword({ email, name, tempPassword, companyName }) {
  const t = getTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || 'no-reply@invoicify';
  const org = companyName || 'your team';

  const subject = 'Your Invoicify temporary password';
  const text = `Hi ${name || 'there'}, your invitation to ${org} is confirmed. Your temporary password is ${tempPassword}. Log in with it and you'll be asked to set your own password before you can continue.`;
  const html = shell(`
        <div style="font-size:15px;font-weight:700;color:#2b2f77;margin:18px 0 6px;">Invitation accepted 🎉</div>
        <p style="font-size:14px;color:#555;line-height:1.55;margin:0 0 18px;">Hi ${name || 'there'}, you're now part of <strong>${org}</strong> on Invoicify. Use the temporary password below to log in.</p>
        <div style="background:#f4f4fb;border:1px solid #e6e6f2;border-radius:14px;padding:18px;text-align:center;margin:0 0 20px;">
          <div style="font-size:12px;color:#999;margin-bottom:8px;">TEMPORARY PASSWORD</div>
          <div style="font-size:26px;font-weight:800;letter-spacing:4px;color:#2b2f77;font-family:'Courier New',monospace;">${tempPassword}</div>
        </div>
        <p style="font-size:13px;color:#555;line-height:1.55;margin:0 0 14px;">For your security this password works <strong>once</strong>. As soon as you enter it, Invoicify will ask you to choose your own password — you'll then log in with that.</p>
        <p style="font-size:12.5px;color:#999;line-height:1.5;margin:0;">Please don't share this email with anyone.</p>`);

  if (!t) {
    console.log(`\n============================================================`);
    console.log(`[Invoicify] Email not configured (set SMTP_* in .env).`);
    console.log(`Temporary password for ${email}: ${tempPassword}`);
    console.log(`============================================================\n`);
    return;
  }
  await t.sendMail({ from: `"Invoicify" <${fromAddress}>`, to: email, subject, text, html });
  console.log(`[Invoicify] Temporary password emailed to ${email}`);
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

export async function sendReportEmail({ email, name, companyName, label, csvContent }) {
  const t = getTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || 'no-reply@invoicify';
  const subject = `Your ${label} report — ${companyName}`;
  const text = `Hi ${name || 'there'}, attached is your Invoicify business report for ${label}. It covers all invoices and expenses recorded in that period.`;
  const html = shell(`
        <div style="font-size:15px;font-weight:700;color:#2b2f77;margin:18px 0 6px;">Your ${label} report is ready 📊</div>
        <p style="font-size:14px;color:#555;line-height:1.55;margin:0 0 16px;">Hi ${name || 'there'}, attached is <strong>${companyName}</strong>'s Invoicify report for <strong>${label}</strong> — invoices, expenses, and a summary, in CSV format (opens in Excel/Google Sheets).</p>`);

  const attachmentName = `Invoicify-Report-${label.replace(/\s+/g, '-')}.csv`;

  if (!t) {
    console.log(`[Invoicify] Report for ${email} not sent (email not configured).`);
    return;
  }
  await t.sendMail({
    from: `"Invoicify" <${fromAddress}>`,
    to: email,
    subject,
    text,
    html,
    attachments: [{ filename: attachmentName, content: csvContent, contentType: 'text/csv' }]
  });
  console.log(`[Invoicify] Report emailed to ${email}`);
}
