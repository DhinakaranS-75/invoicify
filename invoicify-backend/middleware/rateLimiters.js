import rateLimit from 'express-rate-limit';

// Shared response shape for all limiters below.
function limitMessage(action) {
  return { message: `Too many ${action} attempts. Please try again in a few minutes.` };
}

// Login: 10 tries / 15 min per IP. Generous enough for a real user who
// fat-fingers their password a couple of times, tight enough to make
// scripted password-guessing impractical.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage('login')
});

// Forgot-password (requesting a new OTP): 5 / 15 min per IP. Keeps someone
// from hammering the email-sending endpoint (costs a Brevo send each time).
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage('password reset request')
});

// Reset-password (submitting an OTP guess): 5 / 15 min per IP. This is on
// top of the per-account 3-strikes/5-hour lockout in authController.js —
// the IP limiter stops someone from rotating between many different
// accounts quickly; the per-account lockout stops them from grinding one
// specific victim's OTP even across different IPs.
export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage('OTP verification')
});

// Email-verification OTP (Settings -> verify email): 5 / 15 min per IP.
export const emailOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage('OTP verification')
});
