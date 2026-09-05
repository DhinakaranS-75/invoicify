import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import { useClickOutside } from '../hooks/useClickOutside';
import { ROLE_LABELS } from '../utils/format';
import { requestNav } from '../utils/navGuard';
// Home stays a normal (non-lazy) import — it's the very first screen almost
// everyone sees right after login, so there's no benefit to splitting it out;
// doing so would just add a loading flicker on the most common path.
import Home from '../pages/Home';
// Everything else only loads its code the moment the person actually visits
// that page, instead of all of it being bundled into the initial download.
const Invoices = lazy(() => import('../pages/Invoices'));
const Quotes = lazy(() => import('../pages/Quotes'));
const Items = lazy(() => import('../pages/Items'));
const Customers = lazy(() => import('../pages/Customers'));
const Reports = lazy(() => import('../pages/Reports'));
const Expenses = lazy(() => import('../pages/Expenses'));
const MoreMenu = lazy(() => import('../pages/MoreMenu'));
const Settings = lazy(() => import('../pages/Settings'));

// Maps our internal page keys to URL paths
const PAGE_PATHS = {
  home: '/home', item: '/items', invoice: '/invoices', quote: '/quotes',
  customer: '/customers', reports: '/reports', expense: '/expenses',
  more: '/more', profile: '/settings'
};
const PATH_TITLES = {
  '/home': '', '/items': 'Items', '/invoices': 'Invoices', '/quotes': 'Quotes',
  '/customers': 'Customers', '/reports': 'Reports', '/expenses': 'Expenses',
  '/more': 'More', '/settings': 'Settings'
};

export default function AppShell() {
  const { currentUser, logout, invoices } = useData();
  const { toggleTheme } = useTheme();
  const { can, role } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // ---- Notifications ----------------------------------------------------
  // Everything here is derived from invoices already in memory, so there is
  // no extra request and it stays in step with the 30s background refresh.
  const notifications = useMemo(() => {
    const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    const today = startOfDay(new Date());
    const weekAhead = new Date(today); weekAhead.setDate(weekAhead.getDate() + 7);

    let overdue = 0, dueSoon = 0, drafts = 0;

    (invoices || []).forEach((inv) => {
      if (inv.status === 'Draft') { drafts += 1; return; }
      if (inv.status === 'Paid') return;

      const paid = (inv.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      if (paid >= (inv.total || 0)) return;          // settled, just not relabelled
      if (!inv.dueDate) return;

      const due = startOfDay(inv.dueDate);
      if (Number.isNaN(due.getTime())) return;
      if (due < today) overdue += 1;
      else if (due <= weekAhead) dueSoon += 1;
    });

    const list = [];
    if (overdue > 0) {
      list.push({
        key: 'overdue', tone: 'ni-red', icon: 'fa-triangle-exclamation',
        title: `${overdue} invoice${overdue > 1 ? 's' : ''} overdue`,
        sub: 'Past the due date and still unpaid.'
      });
    }
    if (dueSoon > 0) {
      list.push({
        key: 'duesoon', tone: 'ni-orange', icon: 'fa-clock',
        title: `${dueSoon} invoice${dueSoon > 1 ? 's' : ''} due this week`,
        sub: 'Worth a follow-up before the date passes.'
      });
    }
    if (drafts > 0) {
      list.push({
        key: 'drafts', tone: 'ni-teal', icon: 'fa-file-pen',
        title: `${drafts} invoice${drafts > 1 ? 's' : ''} still in draft`,
        sub: 'Created but never sent to the customer.'
      });
    }
    return list;
  }, [invoices]);

  // Only overdue work is urgent enough to earn the red dot.
  const hasUrgent = notifications.some((n) => n.key === 'overdue');

  const profileRef = useClickOutside(useCallback(() => setProfileOpen(false), []), profileOpen);
  const notifRef = useClickOutside(useCallback(() => setNotifOpen(false), []), notifOpen);

  const go = (p) => {
    // Permission guards
    if (p === 'reports' && !can('viewReports')) return;
    if (p === 'item' && !can('manageItems')) return;
    if (p === 'customer' && !can('manageCustomers')) return;
    if (p === 'quote' && !can('createInvoice')) return;
    setSidebarOpen(false);
    requestNav(() => navigate(PAGE_PATHS[p] || '/home'));
  };

  const company = currentUser?.company;
  const companyName = company?.name || 'InvoicifysPro';
  const initial = (currentUser?.name || 'U').trim().charAt(0).toUpperCase();
  const currentPath = location.pathname;
  const isMobilePage = currentPath !== '/home' && currentPath !== '/';

  const navLinks = [
    { key: 'home', path: '/home', icon: 'fa-house', label: 'Home', show: true },
    { key: 'item', path: '/items', icon: 'fa-box', label: 'Items', show: can('manageItems') },
    { key: 'invoice', path: '/invoices', icon: 'fa-file-invoice', label: 'Invoices', show: true },
    { key: 'quote', path: '/quotes', icon: 'fa-file-lines', label: 'Quotes', show: can('createInvoice') },
    { key: 'customer', path: '/customers', icon: 'fa-users', label: 'Customers', show: can('manageCustomers') },
    { key: 'reports', path: '/reports', icon: 'fa-chart-pie', label: 'Reports', show: can('viewReports') },
    { key: 'expense', path: '/expenses', icon: 'fa-wallet', label: 'Expenses', show: true }
  ];

  // Mobile bottom bar only has room for ~4 tabs. Home/Items/Invoices stay
  // pinned there; everything else (Customers, Reports, Expenses, and any
  // future addition) lives behind the "More" sheet instead of squeezing
  // in another icon. The desktop sidebar still shows the full navLinks list.
  const MOBILE_PRIMARY_KEYS = ['home', 'item', 'invoice'];
  const mobilePrimaryLinks = navLinks.filter((l) => l.show && MOBILE_PRIMARY_KEYS.includes(l.key));
  const mobileMoreLinks = navLinks.filter((l) => l.show && !MOBILE_PRIMARY_KEYS.includes(l.key));
  // Settings isn't part of navLinks (it's not on the desktop sidebar either —
  // desktop reaches it via the top gear icon). On mobile it now lives at the
  // end of the More sheet instead of the profile dropdown.
  if (can('manageSettings')) {
    mobileMoreLinks.push({ key: 'profile', path: '/settings', icon: 'fa-gear', label: 'Settings' });
  }
  const isMoreLinkActive = currentPath === '/more' || mobileMoreLinks.some((l) => l.path === currentPath);

  // Combined left-to-right order of the bottom bar's actual tab slots
  // (primary tabs + the More tab), used to slide the notch/bubble to
  // whichever one is active.
  const allMobileTabs = [
    ...mobilePrimaryLinks,
    ...(mobileMoreLinks.length > 0 ? [{ key: 'more', icon: 'fa-bars', label: 'More' }] : [])
  ];
  const activeTabIndex = allMobileTabs.findIndex((t) => (t.key === 'more' ? isMoreLinkActive : currentPath === t.path));

  return (
    <div className={'app-screen' + (isMobilePage ? ' mobile-page-titled' : '')}>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)}></div>}

      {/* TOP NAVBAR */}
      <div className="app-nav">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen((s) => !s)}>
          <i className="fa-solid fa-bars"></i>
        </button>
        <div className="app-nav-left">
          <div className="brand-logo" onClick={() => go('home')} style={{ cursor: 'pointer' }}>
            {company?.logo ? <img src={company.logo} alt="logo" /> : <i className="fa-solid fa-file-invoice-dollar"></i>}
          </div>
          <div className="brand-name" onClick={() => go('home')} style={{ cursor: 'pointer' }}>{companyName}</div>
          <div className="nav-page-title">{PATH_TITLES[currentPath] || ''}</div>
        </div>

        <div className="app-nav-search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input type="text" placeholder="Search invoices, customers, items…" />
        </div>

        <div className="app-nav-right">
          {/* Notification bell — now shown on both mobile and desktop */}
          <div className="nav-notif-wrap" style={{ position: 'relative' }} ref={notifRef}>
            <button id="nav-notif-btn" className="icon-btn" onClick={() => setNotifOpen((o) => !o)} title="Notifications">
              <i className="fa-solid fa-bell"></i>
              {hasUrgent && <span className="notif-dot"></span>}
            </button>
            {notifOpen && (
              <div className="notif-dropdown show">
                <div className="notif-head">Notifications</div>
                <div className="notif-list">
                  {notifications.length === 0
                    ? <div className="notif-empty">You're all caught up!</div>
                    : notifications.map((n) => (
                      <button
                        className="notif-item notif-item-btn"
                        key={n.key}
                        onClick={() => { setNotifOpen(false); go('invoice'); }}
                      >
                        <span className={'notif-icon ' + n.tone}><i className={'fa-solid ' + n.icon}></i></span>
                        <span className="notif-text"><strong>{n.title}</strong><br />{n.sub}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          <button className="icon-btn nav-theme-btn" onClick={toggleTheme} title="Toggle theme">
            <i className="fa-solid fa-moon"></i>
          </button>

          {/* Desktop tools */}
          <div className="nav-tools-movable">
            {can('manageSettings') && (
              <button className="icon-btn settings-gear-btn" title="Settings" onClick={() => go('profile')}>
                <i className="fa-solid fa-gear"></i>
              </button>
            )}
          </div>

          {/* Profile avatar */}
          <div className="profile-wrap" style={{ position: 'relative' }} ref={profileRef}>
            <button className="avatar-btn" onClick={() => setProfileOpen((o) => !o)}>
              <div className="avatar">{currentUser?.avatar ? <img src={currentUser.avatar} alt="me" /> : initial}</div>
            </button>
            {profileOpen && (
              <div className="profile-dropdown show">
                <div className="pd-header">
                  <div className="avatar pd-avatar">{currentUser?.avatar ? <img src={currentUser.avatar} alt="me" /> : initial}</div>
                  <div className="pd-identity">
                    <div className="pd-name">{currentUser?.name}</div>
                    <div className="pd-email">{currentUser?.email}</div>
                  </div>
                </div>
                <div className="pd-rows">
                  <div className="pd-row"><span>Company</span><strong>{company?.name || '—'}</strong></div>
                  <div className="pd-row"><span>Role</span><strong>{ROLE_LABELS[role] || 'Admin'}</strong></div>
                </div>
                {can('manageSettings') && (
                  <button className="profile-settings-btn" onClick={() => { setProfileOpen(false); go('profile'); }}>
                    <i className="fa-solid fa-gear"></i> Settings
                  </button>
                )}
                <button className="profile-logout-btn" onClick={() => { setProfileOpen(false); logout(); }}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BODY: sidebar + main */}
      <div className="app-shell">
        <aside className={'sidebar' + (collapsed ? ' collapsed' : '') + (sidebarOpen ? ' mobile-open' : '')}>
          <nav className="side-nav">
            {navLinks.filter((l) => l.show).map((l) => (
              <button
                key={l.key}
                className={'side-link' + (currentPath === l.path ? ' active' : '')}
                data-page={l.key}
                onClick={() => go(l.key)}
              >
                <i className={'fa-solid ' + l.icon}></i>
                <span>{l.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-bottom">
            <button className="sidebar-toggle" onClick={() => setCollapsed((c) => !c)} title="Collapse sidebar">
              <i className={'fa-solid ' + (collapsed ? 'fa-angles-right' : 'fa-angles-left')}></i>
            </button>
          </div>
        </aside>

        <main className="app-main">
          <Suspense fallback={<div className="page-loading"><i className="fa-solid fa-spinner fa-spin"></i></div>}>
            <Routes>
              <Route path="/home" element={<Home go={go} />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/quotes" element={can('createInvoice') ? <Quotes /> : <Navigate to="/home" replace />} />
              <Route path="/items" element={can('manageItems') ? <Items /> : <Navigate to="/home" replace />} />
              <Route path="/customers" element={can('manageCustomers') ? <Customers /> : <Navigate to="/home" replace />} />
              <Route path="/reports" element={can('viewReports') ? <Reports /> : <Navigate to="/home" replace />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/more" element={<MoreMenu links={mobileMoreLinks} go={go} currentUser={currentUser} company={company} />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      {/* MOBILE BOTTOM TAB BAR — hidden on desktop via CSS (@media max-width:1023px only) */}
      <nav className="mobile-tabbar">
        {activeTabIndex >= 0 && (
          <>
            <div
              className="mobile-tab-notch"
              style={{ width: `${100 / allMobileTabs.length}%`, transform: `translateX(${activeTabIndex * 100}%)` }}
            >
              <svg className="mobile-tab-notch-svg" viewBox="0 0 90 38" preserveAspectRatio="none">
                <path d="M0,0 C20,0 24,34 45,34 C66,34 70,0 90,0 Z" />
              </svg>
            </div>
            <div
              className="mobile-tab-bubble"
              style={{ width: `${100 / allMobileTabs.length}%`, transform: `translateX(${activeTabIndex * 100}%)` }}
            >
              <span className="mobile-tab-bubble-circle">
                <i className={'fa-solid ' + allMobileTabs[activeTabIndex].icon}></i>
              </span>
            </div>
          </>
        )}
        {mobilePrimaryLinks.map((l, i) => (
          <button
            key={l.key}
            className={'mobile-tab' + (currentPath === l.path ? ' active' : '')}
            onClick={() => go(l.key)}
          >
            <span className="mobile-tab-icon-wrap" style={activeTabIndex === i ? { visibility: 'hidden' } : undefined}>
              <i className={'fa-solid ' + l.icon}></i>
            </span>
            <span>{l.label}</span>
          </button>
        ))}
        {mobileMoreLinks.length > 0 && (
          <button
            className={'mobile-tab' + (isMoreLinkActive ? ' active' : '')}
            onClick={() => go('more')}
          >
            <span
              className="mobile-tab-icon-wrap"
              style={activeTabIndex === mobilePrimaryLinks.length ? { visibility: 'hidden' } : undefined}
            >
              <i className="fa-solid fa-bars"></i>
            </span>
            <span>More</span>
          </button>
        )}
      </nav>
    </div>
  );
}