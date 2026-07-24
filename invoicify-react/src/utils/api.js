// Central helper for talking to the backend API.
//
// Backend port (change here if your backend runs on a different port).
const API_PORT = 5000;

// Figure out the backend base URL:
// - If VITE_API_URL is set in .env, use that (highest priority).
// - Otherwise use the SAME hostname the frontend is loaded from, on the API port.
//   This means: on the computer it's http://localhost:5000, and on a phone
//   opening http://192.168.1.5:5173 it's automatically http://192.168.1.5:5000.
function resolveBaseUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const host = window.location.hostname || 'localhost';
  return `http://${host}:${API_PORT}`;
}

const BASE_URL = resolveBaseUrl();

// --- Token storage (kept in memory + localStorage so login survives refresh) ---
let authToken = localStorage.getItem('invoicify_token') || null;

export function setToken(token) {
  authToken = token;
  if (token) localStorage.setItem('invoicify_token', token);
  else localStorage.removeItem('invoicify_token');
}

export function getToken() {
  return authToken;
}

// --- Session-expiry hook -----------------------------------------------
// DataContext registers a callback here. Any 401 coming back from a request
// that DID carry a token means the token is expired/invalid, so the app logs
// out cleanly instead of leaving the user on a half-broken screen.
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// Endpoints where a 401 is a normal answer (wrong password etc.), not an
// expired session — these must never trigger an auto-logout.
const PUBLIC_AUTH_PATHS = ['/api/auth/login', '/api/auth/register'];

// Core request function. Automatically attaches JSON headers + auth token.
async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const hadToken = !!authToken;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (networkErr) {
    // Server not reachable
    throw new Error('Cannot reach the server. Is the backend running?');
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { message: text }; }
  }

  if (res.status === 401 && hadToken && !PUBLIC_AUTH_PATHS.some((p) => path.startsWith(p))) {
    // Session is gone — tell the app to log out.
    if (onUnauthorized) onUnauthorized();
    throw new Error('Your session has expired. Please log in again.');
  }

  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return data;
}

// Convenience methods
export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' })
};
