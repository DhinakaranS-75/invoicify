import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { buildInvoiceNumber, DEFAULT_INVOICE_NUMBER_CONFIG } from '../utils/invoiceNumber';
import { api, setToken, getToken, setUnauthorizedHandler } from '../utils/api';
import { useToast } from './ToastContext';

const DataContext = createContext(null);

// Auto-logout after this much inactivity, with a warning shortly before.
const IDLE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes
const IDLE_WARN_MS = 60 * 1000;       // warn for the final 60 seconds

// How often to quietly re-fetch shared company data so changes made by
// team members show up without a manual page refresh.
const AUTO_REFRESH_MS = 30 * 1000;   // 30 seconds

// Backend returns Mongo `_id`; the UI historically uses `id`.
// This adds an `id` alias so both work everywhere.
function withId(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  return { ...doc, id: doc._id || doc.id };
}
function withIds(arr) {
  return (arr || []).map(withId);
}

export function DataProvider({ children }) {
  const { toast } = useToast();
  const [currentUser, setCurrentUserRaw] = useState(null);
  // Seconds left before an idle logout (null = no warning showing)
  const [idleCountdown, setIdleCountdown] = useState(null);
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);
  // When the background sync last succeeded (null until the first one)
  const [lastSynced, setLastSynced] = useState(null);
  const syncingRef = useRef(false);
  // Always alias Mongo _id -> id so currentUser.id is available everywhere.
  const setCurrentUser = (u) => setCurrentUserRaw(u && typeof u === 'object' ? withId(u) : u);
  const [invoices, setInvoices] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  // Income is still local for now (dashboard-only feature).
  // Expenses are saved to the backend (see loadAllData / addExpense below).
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [loading, setLoading] = useState(true);   // initial "am I logged in?" check
  const [booting, setBooting] = useState(true);

  const invoiceNumberConfig = currentUser?.invoiceNumberConfig || DEFAULT_INVOICE_NUMBER_CONFIG;
  const invoiceTemplate = currentUser?.invoiceTemplate || 'classic';
  const companySignature = currentUser?.company?.signature || null;
  const currency = currentUser?.company?.currency || 'INR';

  const nextInvoiceNumber = useCallback(
    () => buildInvoiceNumber(invoiceNumberConfig),
    [invoiceNumberConfig]
  );

  // ---- Load all company data after login ----
  const loadAllData = useCallback(async () => {
    try {
      const [inv, cust, items, exp, teamRes] = await Promise.all([
        api.get('/api/invoices'),
        api.get('/api/customers'),
        api.get('/api/items'),
        api.get('/api/expenses'),
        api.get('/api/auth/team').catch(() => ({ team: [] }))
      ]);
      setInvoices(withIds(inv));
      setCustomers(withIds(cust));
      setCatalogItems(withIds(items));
      setExpenses(withIds(exp));
      setTeamMembers(withIds(teamRes?.team));
    } catch (err) {
      console.error('Failed to load data:', err.message);
    }

    // Quotes fetched separately, deliberately NOT part of the Promise.all
    // above. A brand-new "quotes" MongoDB collection can be slow on its
    // very first query ever (index build), and bundling it into the same
    // Promise.all would freeze the ENTIRE dashboard at zero — invoices,
    // customers, everything — until that one-time delay finishes. Fetching
    // it on its own means only the Quotes page waits a moment longer the
    // first time; nothing else is held hostage by it.
    try {
      const quo = await api.get('/api/quotes');
      setQuotes(withIds(quo));
    } catch (err) {
      console.error('Failed to load quotes:', err.message);
    }
  }, []);

  // ---- On app start: if we have a token, fetch the current user ----
  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { setBooting(false); setLoading(false); return; }
      try {
        const { user } = await api.get('/api/auth/me');
        setCurrentUser(user);
        await loadAllData();
      } catch {
        setToken(null); // token invalid/expired
      } finally {
        setBooting(false);
        setLoading(false);
      }
    })();
  }, [loadAllData]);

  // ---- Auth ----
  const registerUser = useCallback(async (data) => {
    // role is intentionally NOT sent — the backend always makes a
    // self-registered account the company Admin (full control).
    const res = await api.post('/api/auth/register', {
      firstName: data.firstName, lastName: data.lastName,
      email: data.email, password: data.password
    });
    return res.user; // does NOT auto-login (matches original flow: go to login)
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    // Invited member still on their temporary password: no session is created,
    // the caller sends them to the "set your password" screen instead.
    if (res.mustResetPassword) return res;
    setToken(res.token);
    setCurrentUser(res.user);
    await loadAllData();
    return res;
  }, [loadAllData]);

  const logout = useCallback(() => {
    setToken(null);
    setCurrentUser(null);
    setInvoices([]); setQuotes([]); setCustomers([]); setCatalogItems([]); setTeamMembers([]);
    setIdleCountdown(null);
    warningShownRef.current = false;
  }, []);

  // Dismiss the idle warning and start the clock again.
  const stayLoggedIn = useCallback(() => {
    lastActivityRef.current = Date.now();
    warningShownRef.current = false;
    setIdleCountdown(null);
  }, []);

  // --- Expired/invalid token anywhere in the app -> clean logout ----------
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      toast('Session expired', 'Please log in again.', 'error');
    });
    return () => setUnauthorizedHandler(null);
  }, [logout, toast]);

  // --- Background auto-refresh -------------------------------------------
  // Team members share a companyId, so anything HAPPY adds belongs to the
  // same company. This quietly re-fetches it so the admin sees new invoices,
  // customers and items without pressing F5.
  //
  // Deliberately quiet: failures are logged, never toasted, and the poll is
  // skipped while the tab is hidden or a previous sync is still running.
  // It does NOT count as user activity, so it can't defeat the idle logout.
  useEffect(() => {
    if (!currentUser) return undefined;

    const sync = async () => {
      if (syncingRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      syncingRef.current = true;
      try {
        await loadAllData();
        setLastSynced(new Date());
      } catch (err) {
        console.error('[InvoicifysPro] background sync failed:', err.message);
      } finally {
        syncingRef.current = false;
      }
    };

    const timer = setInterval(sync, AUTO_REFRESH_MS);
    // Coming back to the tab? Refresh straight away rather than waiting.
    const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentUser, loadAllData]);

  // --- Idle auto-logout ---------------------------------------------------
  // Any real interaction pushes the deadline back. Once the warning is
  // showing, stray mouse movement no longer counts — the user has to click
  // "Stay logged in", otherwise the logout goes ahead.
  useEffect(() => {
    if (!currentUser) return undefined;

    // Only enforce the 10-minute idle timeout in a regular browser tab.
    // The installed app (PWA/TWA) relies on App Lock (PIN) instead — matches
    // how apps like Zoho and Swipe Billing behave: strict timeout on the
    // website, PIN-based quick unlock on the phone app, no forced full logout.
    const isInstalledApp =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true; // iOS Safari "Add to Home Screen"
    if (isInstalledApp) return undefined;

    lastActivityRef.current = Date.now();
    warningShownRef.current = false;

    const bump = () => {
      if (!warningShownRef.current) lastActivityRef.current = Date.now();
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    // Works off real elapsed time, never a tick count, so it stays correct
    // even when the browser throttles or freezes timers in a background tab.
    const check = () => {
      const left = IDLE_LIMIT_MS - (Date.now() - lastActivityRef.current);
      if (left <= 0) {
        logout();
        toast('Signed out', 'You were inactive for 10 minutes.', 'error');
      } else if (left <= IDLE_WARN_MS) {
        warningShownRef.current = true;
        setIdleCountdown(Math.ceil(left / 1000));
      }
    };

    const tick = setInterval(check, 1000);

    // Chrome heavily throttles (and can fully freeze) timers in a background
    // tab, so the interval alone can miss the deadline. Re-check the moment
    // the tab becomes visible again and log out if the time has already gone.
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      clearInterval(tick);
    };
  }, [currentUser, logout, toast]);

  const deleteAccount = useCallback(async (deleteData) => {
    await api.del(`/api/auth/account${deleteData ? '?deleteData=true' : ''}`);
    logout();
  }, [logout]);

  const updateCurrentUser = useCallback(async (patch) => {
    // Decide which backend endpoint based on what's being updated
    try {
      if ('firstName' in patch || 'lastName' in patch || 'email' in patch || 'avatar' in patch) {
        const { user } = await api.put('/api/auth/profile', patch);
        setCurrentUser(user);
        return user;
      }
      // company / onboarding / preferences
      const payload = {};
      if ('company' in patch) payload.company = patch.company;
      if ('onboarded' in patch) payload.onboarded = patch.onboarded;
      if ('invoiceTemplate' in patch) payload.invoiceTemplate = patch.invoiceTemplate;
      if ('invoiceNumberConfig' in patch) payload.invoiceNumberConfig = patch.invoiceNumberConfig;
      if ('companySignature' in patch) payload.companySignature = patch.companySignature;
      if ('companyId' in patch) payload.company = patch.company || currentUser?.company;
      const { user } = await api.put('/api/auth/company', payload);
      setCurrentUser(user);
      return user;
    } catch (err) {
      console.error('Update user failed:', err.message);
      throw err;
    }
  }, [currentUser]);

  // ---- Invoices ----
  const addInvoice = useCallback(async (invoice) => {
    const created = await api.post('/api/invoices', invoice);
    setInvoices((prev) => [...prev, withId(created)]);
    // bump next invoice number
    const cfg = currentUser?.invoiceNumberConfig || DEFAULT_INVOICE_NUMBER_CONFIG;
    api.put('/api/auth/company', { invoiceNumberConfig: { ...cfg, next: (cfg.next || 1) + 1 } })
      .then(({ user }) => setCurrentUser(user)).catch(() => {});
    return created;
  }, [currentUser]);

  const updateInvoice = useCallback(async (id, patch) => {
    const updated = await api.put(`/api/invoices/${id}`, patch);
    setInvoices((prev) => prev.map((i) => ((i._id === id || i.id === id) ? withId(updated) : i)));
    return updated;
  }, []);

  const deleteInvoice = useCallback(async (id) => {
    await api.del(`/api/invoices/${id}`);
    setInvoices((prev) => prev.filter((i) => i._id !== id && i.id !== id));
  }, []);

  const duplicateInvoice = useCallback(async (id) => {
    const inv = invoices.find((i) => i._id === id || i.id === id);
    if (!inv) return;
    const cfg = currentUser?.invoiceNumberConfig || DEFAULT_INVOICE_NUMBER_CONFIG;
    const copy = {
      number: buildInvoiceNumber(cfg),
      orderNumber: inv.orderNumber, date: new Date().toISOString().slice(0, 10),
      dueDate: inv.dueDate, client: inv.client, status: 'Draft',
      total: inv.total, snapshot: inv.snapshot, payments: []
    };
    const created = await api.post('/api/invoices', copy);
    setInvoices((prev) => [...prev, withId(created)]);
    api.put('/api/auth/company', { invoiceNumberConfig: { ...cfg, next: (cfg.next || 1) + 1 } })
      .then(({ user }) => setCurrentUser(user)).catch(() => {});
  }, [invoices, currentUser]);

  // ---- Quotes/Estimates ----
  const addQuote = useCallback(async (quote) => {
    const created = await api.post('/api/quotes', quote);
    setQuotes((prev) => [...prev, withId(created)]);
    return created;
  }, []);

  const updateQuote = useCallback(async (id, patch) => {
    const updated = await api.put(`/api/quotes/${id}`, patch);
    setQuotes((prev) => prev.map((q) => ((q._id === id || q.id === id) ? withId(updated) : q)));
    return updated;
  }, []);

  const deleteQuote = useCallback(async (id) => {
    await api.del(`/api/quotes/${id}`);
    setQuotes((prev) => prev.filter((q) => q._id !== id && q.id !== id));
  }, []);

  // Turns an accepted quote into a real Draft invoice — reuses the same
  // invoice-number sequence as "Create New Invoice" (bumped by addInvoice
  // itself), and marks the quote as Converted with a link to the new invoice
  // so the quote list shows what it became.
  const convertQuoteToInvoice = useCallback(async (quoteId) => {
    const q = quotes.find((x) => x._id === quoteId || x.id === quoteId);
    if (!q) return null;
    const invoiceObj = {
      number: buildInvoiceNumber(currentUser?.invoiceNumberConfig || DEFAULT_INVOICE_NUMBER_CONFIG),
      orderNumber: '', date: new Date().toISOString().slice(0, 10),
      dueDate: q.validUntil || new Date().toISOString().slice(0, 10),
      client: q.client, status: 'Draft', total: q.total, snapshot: q.snapshot, payments: []
    };
    const createdInvoice = await addInvoice(invoiceObj);
    await updateQuote(q._id || q.id, { status: 'Converted', convertedInvoiceId: createdInvoice._id || createdInvoice.id });
    return createdInvoice;
  }, [quotes, currentUser, addInvoice, updateQuote]);

  // ---- Customers ----
  const addCustomer = useCallback(async (c) => {
    const created = await api.post('/api/customers', c);
    setCustomers((prev) => [...prev, withId(created)]);
    return created;
  }, []);
  const updateCustomer = useCallback(async (id, patch) => {
    const updated = await api.put(`/api/customers/${id}`, patch);
    setCustomers((prev) => prev.map((c) => ((c._id === id || c.id === id) ? withId(updated) : c)));
  }, []);
  const deleteCustomers = useCallback(async (ids) => {
    await Promise.all(ids.map((id) => api.del(`/api/customers/${id}`)));
    setCustomers((prev) => prev.filter((c) => !ids.includes(c._id) && !ids.includes(c.id)));
  }, []);

  // ---- Items ----
  const addItem = useCallback(async (it) => {
    const created = await api.post('/api/items', it);
    setCatalogItems((prev) => [...prev, withId(created)]);
    return created;
  }, []);
  const updateItem = useCallback(async (id, patch) => {
    const updated = await api.put(`/api/items/${id}`, patch);
    setCatalogItems((prev) => prev.map((i) => ((i._id === id || i.id === id) ? withId(updated) : i)));
  }, []);
  const deleteItems = useCallback(async (ids) => {
    await Promise.all(ids.map((id) => api.del(`/api/items/${id}`)));
    setCatalogItems((prev) => prev.filter((i) => !ids.includes(i._id) && !ids.includes(i.id)));
  }, []);

  // ---- Income (local only for now) ----
  const addIncome = useCallback((entry) => setIncomes((prev) => [...prev, entry]), []);
  const deleteIncome = useCallback((id) => setIncomes((prev) => prev.filter((e) => e.id !== id)), []);

  // ---- Expenses (saved to the backend) ----
  const addExpense = useCallback(async (entry) => {
    const created = await api.post('/api/expenses', entry);
    setExpenses((prev) => [...prev, withId(created)]);
    return created;
  }, []);
  const deleteExpense = useCallback(async (id) => {
    await api.del(`/api/expenses/${id}`);
    setExpenses((prev) => prev.filter((e) => e._id !== id && e.id !== id));
  }, []);

  // ---- Team ----
  const loadTeam = useCallback(async () => {
    try {
      const { team } = await api.get('/api/auth/team');
      setTeamMembers(withIds(team));
    } catch { /* ignore */ }
  }, []);

  const addTeamMember = useCallback(async (member) => {
    const res = await api.post('/api/auth/team', member);
    setTeamMembers((prev) => [...prev, withId(res.member)]);
    return res; // { member, inviteLink, emailSent }
  }, []);

  const resendInvite = useCallback(async (id) => {
    const res = await api.post(`/api/auth/team/${id}/resend`);
    await loadTeam();
    return res; // { message, inviteLink? }
  }, [loadTeam]);
  const removeTeamMember = useCallback(async (id) => {
    await api.del(`/api/auth/team/${id}`);
    setTeamMembers((prev) => prev.filter((x) => x._id !== id && x.id !== id));
  }, []);

  // Preference setters (persist to backend)
  const setInvoiceTemplate = useCallback((tpl) => updateCurrentUser({ invoiceTemplate: tpl }), [updateCurrentUser]);
  const setInvoiceNumberConfig = useCallback((cfg) => updateCurrentUser({ invoiceNumberConfig: cfg }), [updateCurrentUser]);
  const setCompanySignature = useCallback((sig) => updateCurrentUser({ companySignature: sig }), [updateCurrentUser]);

  const value = {
    currentUser, setCurrentUser, updateCurrentUser,
    booting,
    invoices, addInvoice, updateInvoice, deleteInvoice, duplicateInvoice,
    quotes, addQuote, updateQuote, deleteQuote, convertQuoteToInvoice,
    customers, addCustomer, updateCustomer, deleteCustomers,
    catalogItems, addItem, updateItem, deleteItems,
    incomes, addIncome, deleteIncome,
    expenses, addExpense, deleteExpense,
    teamMembers, addTeamMember, removeTeamMember, resendInvite, loadTeam,
    invoiceNumberConfig, setInvoiceNumberConfig, nextInvoiceNumber,
    invoiceTemplate, setInvoiceTemplate,
    companySignature, setCompanySignature,
    currency,
    registerUser, login, logout, deleteAccount, idleCountdown, stayLoggedIn,
    lastSynced, refreshNow: loadAllData,
    // legacy: some components read `users`; keep an empty stub to avoid crashes
    users: []
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}