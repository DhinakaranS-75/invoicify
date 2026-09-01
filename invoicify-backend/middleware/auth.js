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
    next();
  } catch (err) {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
}
