import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import LoginActivity from '../models/LoginActivity.js';

// Protects a route: requires a valid "Authorization: Bearer <token>" header.
// Attaches the logged-in user to req.user.
export async function protect(req, res, next) {
  try {
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // If this token is tied to a session (see authController.generateToken),
    // check it hasn't been remotely logged out from the Active Sessions
    // list. Older tokens issued before this feature existed have no
    // sessionId — those are let through unchanged (no forced logout).
    if (decoded.sessionId) {
      const session = await LoginActivity.findById(decoded.sessionId).select('revoked').lean();
      if (!session || session.revoked) {
        return res.status(401).json({ message: 'This session has been logged out. Please log in again.' });
      }
      req.sessionId = decoded.sessionId;
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = user;

    // Keep the inactivity clock (see cronController.runInactivityCheck)
    // fresh based on REAL app usage, not just the login form. Without
    // this, someone who unlocks the installed app via its PIN (App Lock)
    // every day — never hitting /api/auth/login again — would still look
    // "inactive" to the 15/25/30-day check, since PIN-unlock never calls
    // login(). Any authenticated request counts as activity here instead.
    // Throttled to once per 12h so this doesn't write to the DB on every
    // single API call, and fire-and-forget so it never slows the request.
    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
    if (!user.lastLoginAt || user.lastLoginAt.getTime() < twelveHoursAgo) {
      User.updateOne({ _id: user._id }, {
        $set: { lastLoginAt: new Date() },
        $unset: { inactivityWarning15SentAt: '', inactivityWarning25SentAt: '', scheduledDeletionAt: '' }
      }).catch((err) => console.error('Failed to update lastLoginAt:', err.message));
    }

    next();
  } catch (err) {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
}