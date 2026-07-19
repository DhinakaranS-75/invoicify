import { useEffect, useRef } from 'react';

/**
 * Calls `handler` when a click/touch occurs outside the referenced element.
 * Usage: const ref = useClickOutside(() => setOpen(false));
 */
export function useClickOutside(handler, active = true) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return;
    const listener = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      handler(e);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [handler, active]);
  return ref;
}
