// A tiny cross-component navigation guard. A form (e.g. the invoice editor)
// registers an interceptor via registerNavGuard(). Navigation code (AppShell's
// go()) calls requestNav(proceed): if a guard is active it decides when to run
// proceed() (e.g. after the user confirms in an "unsaved changes" dialog).
let interceptor = null;

export function registerNavGuard(fn) { interceptor = fn; }
export function clearNavGuard() { interceptor = null; }

export function requestNav(proceed) {
  if (interceptor) interceptor(proceed);
  else proceed();
}
