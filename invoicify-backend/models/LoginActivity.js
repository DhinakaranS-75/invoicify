import mongoose from 'mongoose';

// One document per successful login. Auto-deleted after 90 days (see the
// TTL index below) so this doesn't grow forever.
const loginActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ip: String,
  device: String, // friendly summary, e.g. "Chrome on Windows" — see parseUserAgent()
  // Set to true when the user clicks "Log out" on this session from the
  // Active Sessions list. Once revoked, the JWT tied to this session ID
  // is rejected on its next request, even though the token itself hasn't
  // technically expired yet — see middleware/auth.js.
  revoked: { type: Boolean, default: false }
}, { timestamps: true });

loginActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model('LoginActivity', loginActivitySchema);
