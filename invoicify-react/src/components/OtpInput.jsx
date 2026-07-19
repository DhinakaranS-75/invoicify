import { useRef } from 'react';

/**
 * Segmented OTP input — one box per digit, auto-advances while typing,
 * backspace moves back, and pasting a full code fills every box.
 * `value` is the compact digit string; `onChange` receives the new string.
 */
export default function OtpInput({ value = '', onChange, length = 6 }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const emit = (arr) => onChange(arr.join('').slice(0, length));

  const handleChange = (i, e) => {
    const d = e.target.value.replace(/\D/g, '').slice(-1);
    const arr = [...digits];
    arr[i] = d;
    emit(arr);
    if (d && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      const arr = [...digits];
      if (digits[i]) {
        arr[i] = '';
        emit(arr);
      } else if (i > 0) {
        arr[i - 1] = '';
        emit(arr);
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, length - 1);
    setTimeout(() => refs.current[focusIdx]?.focus(), 0);
  };

  return (
    <div className="otp-input" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digits[i]}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className="otp-box"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
