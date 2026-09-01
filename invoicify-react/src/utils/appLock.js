// App Lock (PIN screen) — a LOCAL, client-side convenience lock, separate
// from real authentication. The JWT token from login is what actually
// authenticates with the backend; this PIN just gates the UI so re-opening
// the installed app doesn't require retyping the full email + password
// every time. The PIN is hashed (SHA-256) before storing — not because this
// needs to withstand a determined attacker with devtools access (it can't,
// it's client-side), but so the PIN isn't sitting around in plain text.

const PIN_HASH_KEY = 'appLockPinHash';

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isAppLockEnabled() {
  return !!localStorage.getItem(PIN_HASH_KEY);
}

export async function setAppLockPin(pin) {
  localStorage.setItem(PIN_HASH_KEY, await sha256Hex(pin));
}

export async function verifyAppLockPin(pin) {
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!stored) return false;
  return (await sha256Hex(pin)) === stored;
}

export function disableAppLock() {
  localStorage.removeItem(PIN_HASH_KEY);
}
