import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Item from '../models/Item.js';
import Invoice from '../models/Invoice.js';
import { sendResetOtp, sendAccountDeleted } from '../utils/mailer.js';

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
      role: role || 'admin',
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
    }).select('-password');
    res.json({ team: members });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/auth/team  (create a login account for a team member)
export async function addTeamMember(req, res) {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Email already registered.' });

    const parts = name.trim().split(' ');
    const member = await User.create({
      name: name.trim(),
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
      email, password, role: role || 'staff',
      onboarded: true,
      company: req.user.company,
      companyId: req.user.companyId
    });
    res.status(201).json({ member: member.toSafeObject() });
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
