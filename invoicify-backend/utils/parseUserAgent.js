// Turns a raw User-Agent string into a short, friendly summary for the
// "Login Activity" list, e.g. "Chrome on Windows" or "Safari on iPhone".
// Deliberately simple regex matching, not a full UA-parsing library — good
// enough for a readable label, not meant to be 100% precise.
export function parseUserAgent(ua = '') {
  let browser = 'Unknown browser';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome\//i.test(ua)) browser = 'Chrome';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/safari\//i.test(ua)) browser = 'Safari';

  let device = 'Unknown device';
  if (/android/i.test(ua)) device = 'Android';
  else if (/iphone/i.test(ua)) device = 'iPhone';
  else if (/ipad/i.test(ua)) device = 'iPad';
  else if (/windows/i.test(ua)) device = 'Windows';
  else if (/mac os/i.test(ua)) device = 'Mac';
  else if (/linux/i.test(ua)) device = 'Linux';

  return `${browser} on ${device}`;
}
