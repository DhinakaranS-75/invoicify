// Password strength meter shown under "new password" fields.
//
// Deliberately simple and offline — no library, no network. The goal isn't a
// perfect crack-time estimate, it's to stop obviously bad passwords like
// "123456789" or "password1" from being used on a real invoicing account.

// The passwords attackers try first. Anything here scores zero no matter
// how long it is.
const COMMON = [
  '123456', '123456789', '12345678', '1234567890', '12345', '1234567',
  'password', 'password1', 'password123', 'passw0rd', 'qwerty', 'qwerty123',
  'abc123', 'iloveyou', 'admin', 'admin123', 'welcome', 'welcome123',
  'letmein', 'monkey', 'dragon', 'football', 'sunshine', 'princess',
  '111111', '000000', '123123', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
  'india123', 'test1234', 'user1234'
];

// "abcdef", "123456", "aaaaaa" style strings
function isSequentialOrRepeated(s) {
  if (s.length < 4) return false;
  const lower = s.toLowerCase();
  if (/^(.)\1+$/.test(lower)) return true; // all one character
  let up = true, down = true;
  for (let i = 1; i < lower.length; i++) {
    const diff = lower.charCodeAt(i) - lower.charCodeAt(i - 1);
    if (diff !== 1) up = false;
    if (diff !== -1) down = false;
  }
  return up || down;
}

export function scorePassword(pw) {
  const password = pw || '';
  const hints = [];

  if (!password) {
    return { score: 0, label: '', hints: [], percent: 0 };
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const lower = password.toLowerCase();

  // Build the "what would make this better" list first — it's shown
  // regardless of score so the user always knows what to do next.
  if (password.length < 12) hints.push('Make it 12+ characters');
  if (!hasUpper || !hasLower) hints.push('Mix capital and small letters');
  if (!hasDigit) hints.push('Add a number');
  if (!hasSymbol) hints.push('Add a symbol like ! @ # ?');

  // Instant fails
  const isCommon = COMMON.includes(lower);
  if (isCommon) {
    return {
      score: 0,
      label: 'Very weak',
      percent: 12,
      hints: ['This is one of the most guessed passwords — please pick another'],
      isCommon: true
    };
  }
  if (isSequentialOrRepeated(password)) {
    return {
      score: 0,
      label: 'Very weak',
      percent: 12,
      hints: ['Avoid straight runs like 123456 or aaaaaa'],
      isCommon: true
    };
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (hasLower && hasUpper) score++;
  if (hasDigit) score++;
  if (hasSymbol) score++;

  // Digits only, or letters only, is weaker than the raw count suggests.
  if (/^\d+$/.test(password) || /^[A-Za-z]+$/.test(password)) {
    score = Math.min(score, 1);
  }
  if (password.length < 8) score = Math.min(score, 1);

  score = Math.max(0, Math.min(4, score - 1)); // squeeze to a 0-4 range

  const label = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][score];
  const percent = [12, 30, 55, 78, 100][score];

  return { score, label, percent, hints, isCommon: false };
}

export default function PasswordStrength({ password }) {
  if (!password) return null;
  const { score, label } = scorePassword(password);

  // Compact segmented meter — a handful of small dashes light up left to
  // right, with the label sitting right next to them (not a full-width bar
  // with text underneath).
  const segments = 4;
  const filled = Math.max(1, score); // even "very weak" (score 0) lights one dash

  return (
    <div className="pw-strength-compact">
      <div className="pw-segments">
        {Array.from({ length: segments }).map((_, i) => (
          <span key={i} className={'pw-seg' + (i < filled ? ' filled pw-lvl-' + score : '')}></span>
        ))}
      </div>
      <span className={'pw-label-compact pw-lvl-' + score}>{label}</span>
    </div>
  );
}
