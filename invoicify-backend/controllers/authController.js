import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Item from '../models/Item.js';
import Invoice from '../models/Invoice.js';
import { sendResetOtp, sendAccountDeleted, sendTeamInvite, sendTempPassword } from '../utils/mailer.js';

// Creates a signed JWT token that expires in 30 days
function generateToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function genCompanyId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return 'CMP-' + s;
}

// ---- Team-invite helpers -------------------------------------------------

// The raw token is emailed; only its sha256 hash is stored in the DB.
function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

// A readable temporary password (no confusing 0/O/1/l characters).
function genTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[crypto.randomInt(chars.length)];
  return s;
}

// Where the "Accept Invitation" button in the email points to.
// Set APP_URL in .env when testing on a phone (e.g. http://192.168.1.5:5173).
function buildInviteLink(rawToken) {
  const base = (process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/invite/${rawToken}`;
}

const INVITE_VALID_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// POST /api/auth/register
export async function register(req, res) {
  try {
    const { firstName, lastName, email, password, role } = req.body;
    if (!email || !password || !firstName) {
      return res.status(400).json({ message: 'Please fill all required fields.' });
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ message: 'Email already registered.' });
    }
    const user = await User.create({
      name: `${firstName} ${lastName || ''}`.trim(),
      firstName, lastName, email, password,
      role: 'admin', // self-registered accounts are always the company admin
      onboarded: false
    });
    res.status(201).json({
      token: generateToken(user._id),
      user: user.toSafeObject()
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/auth/login
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Invited but hasn't clicked "Accept Invitation" yet -> no login allowed.
    if (user.status === 'invited') {
      return res.status(403).json({
        code: 'INVITE_PENDING',
        message: 'Please accept the invitation link we emailed you before logging in.'
      });
    }

    // Still on the temporary password -> do NOT issue a token.
    // The frontend sends them to the "set your password" screen instead.
    if (user.mustResetPassword) {
      return res.json({
        mustResetPassword: true,
        email: user.email,
        name: user.name
      });
    }

    res.json({
      token: generateToken(user._id),
      user: user.toSafeObject()
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/auth/forgot-password  (send a 6-digit reset code by email)
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      // Generate a 6-digit code, store only its bcrypt hash + a 10-minute expiry
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const salt = await bcrypt.genSalt(10);
      user.resetOtp = await bcrypt.hash(otp, salt);
      user.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save(); // password isn't modified, so it won't be re-hashed

      try {
        await sendResetOtp(user.email, otp);
      } catch (mailErr) {
        console.error('Failed to send reset email:', mailErr.message);
      }
    }

    // Always respond the same way, whether or not the email exists,
    // so attackers can't use this to discover registered emails.
    res.json({ message: 'If that email is registered, a reset code has been sent.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/auth/reset-password  (verify the code and set a new password)
export async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, code and new password are required.' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.resetOtp || !user.resetOtpExpiry) {
      return res.status(400).json({ message: 'Invalid or expired reset code.' });
    }
    if (user.resetOtpExpiry.getTime() < Date.now()) {
      user.resetOtp = undefined;
      user.resetOtpExpiry = undefined;
      await user.save();
      return res.status(400).json({ message: 'Reset code has expired. Please request a new one.' });
    }

    const match = await bcrypt.compare(String(otp), user.resetOtp);
    if (!match) return res.status(400).json({ message: 'Invalid reset code.' });

    // Set the new password (pre-save hook hashes it) and clear the code
    user.password = newPassword;
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;
    await user.save();

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/auth/set-password
// Used by an invited member who logged in with their temporary password.
// Deliberately returns NO token — they must log in again with the new password.
export async function setPassword(req, res) {
  try {
    const { email, tempPassword, newPassword } = req.body;
    if (!email || !tempPassword || !newPassword) {
      return res.status(400).json({ message: 'Email, temporary password and new password are required.' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
    if (String(newPassword) === String(tempPassword)) {
      return res.status(400).json({ message: 'Choose a password different from the temporary one.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await user.matchPassword(tempPassword))) {
      return res.status(400).json({ message: 'Temporary password is incorrect or has already been used.' });
    }
    if (!user.mustResetPassword) {
      return res.status(400).json({ message: 'This account already has a password. Please log in normally.' });
    }

    user.password = newPassword;      // pre-save hook hashes it
    user.mustResetPassword = false;
    user.status = 'active';
    await user.save();

    res.json({ message: 'Password set. You can now log in with your new password.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/auth/invite/:token  (public — shows who the invite is for)
export async function getInvite(req, res) {
  try {
    const user = await User.findOne({ inviteToken: hashToken(req.params.token) });
    if (!user || !user.inviteTokenExpiry || user.inviteTokenExpiry.getTime() < Date.now()) {
      return res.status(400).json({ message: 'This invitation link is invalid or has expired.' });
    }
    res.json({
      invite: {
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company?.name || '',
        invitedBy: user.invitedBy || ''
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/auth/invite/:token/accept  (public)
// Accepting activates the account and emails a one-time temporary password.
export async function acceptInvite(req, res) {
  try {
    const user = await User.findOne({ inviteToken: hashToken(req.params.token) });
    if (!user || !user.inviteTokenExpiry || user.inviteTokenExpiry.getTime() < Date.now()) {
      return res.status(400).json({ message: 'This invitation link is invalid or has expired.' });
    }

    const temp = genTempPassword();
    user.password = temp;              // pre-save hook hashes it
    user.mustResetPassword = true;     // login with it will force the set-password screen
    user.status = 'accepted';
    user.inviteToken = undefined;      // link is single-use
    user.inviteTokenExpiry = undefined;
    await user.save();

    try {
      await sendTempPassword({
        email: user.email,
        name: user.name,
        tempPassword: temp,
        companyName: user.company?.name
      });
    } catch (mailErr) {
      console.error('Temp-password email failed:', mailErr.message);
    }

    res.json({
      email: user.email,
      message: 'Invitation accepted. We emailed you a temporary password.'
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// DELETE /api/auth/account  (delete the logged-in user; optionally their data)
export async function deleteAccount(req, res) {
  try {
    const user = req.user;
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const deleteData = req.query.deleteData === 'true';
    const { email, name, companyId } = user;

    // Optionally cascade-delete this company's business data.
    // Note: team members share a companyId, so this removes shared data too.
    if (deleteData && companyId) {
      await Promise.all([
        Customer.deleteMany({ companyId }),
        Item.deleteMany({ companyId }),
        Invoice.deleteMany({ companyId })
      ]);
    }

    await User.deleteOne({ _id: user._id });

    try { await sendAccountDeleted(email, name, deleteData); }
    catch (mailErr) { console.error('Farewell email failed:', mailErr.message); }

    res.json({ message: 'Your account has been deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/auth/me  (returns the currently logged-in user)
export async function getMe(req, res) {
  res.json({ user: req.user });
}

// PUT /api/auth/profile  (update name/email/avatar)
export async function updateProfile(req, res) {
  try {
    const user = await User.findById(req.user._id);
    const { firstName, lastName, email, avatar } = req.body;
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (firstName !== undefined || lastName !== undefined) {
      user.name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    if (email !== undefined) user.email = email;
    if (avatar !== undefined) user.avatar = avatar;
    await user.save();
    res.json({ user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PUT /api/auth/company  (onboarding + company details + preferences)
export async function updateCompany(req, res) {
  try {
    const user = await User.findById(req.user._id);
    const { company, onboarded, invoiceTemplate, invoiceNumberConfig, companySignature } = req.body;

    if (company !== undefined) {
      user.company = { ...(user.company ? user.company.toObject() : {}), ...company };
      if (!user.companyId) user.companyId = genCompanyId();
    }
    if (companySignature !== undefined) {
      user.company = user.company || {};
      user.company.signature = companySignature;
    }
    if (onboarded !== undefined) user.onboarded = onboarded;
    if (invoiceTemplate !== undefined) user.invoiceTemplate = invoiceTemplate;
    if (invoiceNumberConfig !== undefined) user.invoiceNumberConfig = invoiceNumberConfig;

    await user.save();
    res.json({ user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/auth/team  (list team members sharing this company)
export async function getTeam(req, res) {
  try {
    if (!req.user.companyId) return res.json({ team: [] });
    const members = await User.find({
      companyId: req.user.companyId,
      _id: { $ne: req.user._id }
    }).select('-password -inviteToken -inviteTokenExpiry -resetOtp -resetOtpExpiry');
    res.json({ team: members });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/auth/team  (invite a team member — no password is set by the admin)
// The member gets an "Accept Invitation" email and cannot log in until they accept.
export async function addTeamMember(req, res) {
  try {
    const { name, email, role } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required.' });
    }
    if (!req.user.companyId) {
      return res.status(400).json({ message: 'Finish your company setup before inviting team members.' });
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Email already registered.' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const parts = name.trim().split(' ');
    const member = await User.create({
      name: name.trim(),
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
      email,
      // Random unusable placeholder — replaced by the temporary password on accept.
      password: crypto.randomBytes(24).toString('hex'),
      role: role || 'staff',
      onboarded: true,
      company: req.user.company,
      companyId: req.user.companyId,
      status: 'invited',
      inviteToken: hashToken(rawToken),
      inviteTokenExpiry: new Date(Date.now() + INVITE_VALID_MS),
      invitedBy: req.user.name
    });

    const link = buildInviteLink(rawToken);
    let emailSent = true;
    try {
      await sendTeamInvite({
        email: member.email,
        name: member.name,
        role: member.role,
        companyName: req.user.company?.name,
        invitedBy: req.user.name,
        link
      });
    } catch (mailErr) {
      emailSent = false;
      console.error('Invite email failed:', mailErr.message);
    }

    // The link is returned to the admin who created the invite (they're authorised
    // to see it) so it can be shared manually if email delivery isn't set up yet.
    res.status(201).json({ member: member.toSafeObject(), inviteLink: link, emailSent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/auth/team/:id/resend  (re-send an invite or a fresh temporary password)
export async function resendInvite(req, res) {
  try {
    const member = await User.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!member) return res.status(404).json({ message: 'Member not found' });
    if (String(member._id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot re-invite yourself.' });
    }
    if (member.status === 'active' || (!member.status && !member.mustResetPassword)) {
      return res.status(400).json({ message: 'This member has already set their own password.' });
    }

    // Already accepted -> issue a brand new temporary password.
    if (member.status === 'accepted') {
      const temp = genTempPassword();
      member.password = temp;
      member.mustResetPassword = true;
      await member.save();
      try {
        await sendTempPassword({
          email: member.email, name: member.name,
          tempPassword: temp, companyName: member.company?.name
        });
      } catch (mailErr) {
        console.error('Temp-password email failed:', mailErr.message);
      }
      return res.json({ message: 'A new temporary password has been emailed.' });
    }

    // Still pending -> issue a fresh invite link.
    const rawToken = crypto.randomBytes(32).toString('hex');
    member.inviteToken = hashToken(rawToken);
    member.inviteTokenExpiry = new Date(Date.now() + INVITE_VALID_MS);
    await member.save();

    const link = buildInviteLink(rawToken);
    try {
      await sendTeamInvite({
        email: member.email, name: member.name, role: member.role,
        companyName: req.user.company?.name, invitedBy: req.user.name, link
      });
    } catch (mailErr) {
      console.error('Invite email failed:', mailErr.message);
    }
    res.json({ message: 'Invitation re-sent.', inviteLink: link });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// DELETE /api/auth/team/:id  (remove a team member's login)
export async function removeTeamMember(req, res) {
  try {
    const member = await User.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!member) return res.status(404).json({ message: 'Member not found' });
    if (String(member._id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot remove yourself.' });
    }
    await member.deleteOne();
    res.json({ message: 'Member removed', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
