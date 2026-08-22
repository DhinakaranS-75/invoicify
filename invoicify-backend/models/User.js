import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// The "company" details are stored as a nested object on the user.
const companySchema = new mongoose.Schema({
  name: String,
  email: String,
  contact: String,
  contactCode: String,
  address: String,
  state: String,
  country: String,
  timezone: String,
  businessType: String,
  currency: { type: String, default: 'INR' },
  gst: String,
  bankName: String,
  accountNumber: String,
  ifsc: String,
  terms: String,       // default invoice terms & conditions
  logo: String,        // base64 data URL
  signature: String    // base64 data URL (company-wide signature)
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  firstName: String,
  lastName: String,
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'staff', 'worker', 'auditor'], default: 'admin' },
  onboarded: { type: Boolean, default: false },
  company: companySchema,
  companyId: String,       // shared across a company's team members
  avatar: String,          // base64 data URL

  // Email verification — shows a tick/cross next to the email field in
  // Settings. Reset to false whenever the email address itself changes
  // (a new address is unverified until proven again).
  emailVerified: { type: Boolean, default: false },
  emailVerifyOtp: String,        // bcrypt-hashed 6-digit code
  emailVerifyOtpExpiry: Date,

  // Preferences
  invoiceTemplate: { type: String, default: 'classic' },
  invoiceNumberConfig: {
    prefix: { type: String, default: 'INV' },
    middle: { type: String, default: '' },
    separator: { type: String, default: '-' },
    padding: { type: Number, default: 3 },
    next: { type: Number, default: 1 }
  },

  // Password reset (OTP-based) — resetOtp stores a bcrypt-hashed 6-digit code
  resetOtp: String,
  resetOtpExpiry: Date,

  // ---- Team invitation / activation flow ----
  // 'active'   = normal account, can log in
  // 'invited'  = invite email sent, NOT accepted yet -> login blocked
  // 'accepted' = invite accepted, temporary password emailed -> must set own password
  // (existing accounts created before this feature have no value = treated as active)
  status: { type: String, enum: ['active', 'invited', 'accepted'], default: 'active' },
  inviteToken: String,        // sha256 hash of the raw token that goes in the email link
  inviteTokenExpiry: Date,
  mustResetPassword: { type: Boolean, default: false },
  invitedBy: String            // name of the admin who sent the invite
}, { timestamps: true });

// Hash the password automatically before saving (if it changed)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Helper to compare a plain password with the hashed one
userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

// Never send the password back to the client
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetOtp;
  delete obj.resetOtpExpiry;
  delete obj.emailVerifyOtp;
  delete obj.emailVerifyOtpExpiry;
  delete obj.inviteToken;
  delete obj.inviteTokenExpiry;
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;