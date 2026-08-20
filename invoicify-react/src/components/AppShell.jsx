import { useState, useCallback, useMemo } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import { useClickOutside } from '../hooks/useClickOutside';
import { ROLE_LABELS } from '../utils/format';
import { requestNav } from '../utils/navGuard';
import Home from '../pages/Home';
import Invoices from '../pages/Invoices';
import Items from '../pages/Items';
import Customers from '../pages/Customers';
import Reports from '../pages/Reports';
import Expenses from '../pages/Expenses';
import Settings from '../pages/Settings';

// Maps our internal page keys to URL paths
const PAGE_PATHS = {
  home: '/home', item: '/items', invoice: '/invoices',
  customer: '/customers', reports: '/reports', expense: '/expenses', profile: '/settings'
};
const PATH_TITLES = {
  '/home': '', '/items': 'Items', '/invoices': 'Invoices',
  '/customers': 'Customers', '/reports': 'Reports', '/expenses': 'Expenses', '/settings': 'Settings'
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
    setSidebarOpen(false);
    requestNav(() => navigate(PAGE_PATHS[p] || '/home'));
  };

  const company = currentUser?.company;
  const companyName = company?.name || 'Invoicify';
  const initial = (currentUser?.name || 'U').trim().charAt(0).toUpperCase();
  const currentPath = location.pathname;
  const isMobilePage = currentPath !== '/home' && currentPath !== '/';

  const navLinks = [
    { key: 'home', path: '/home', icon: 'fa-house', label: 'Home', show: true },
    { key: 'item', path: '/items', icon: 'fa-box', label: 'Items', show: can('manageItems') },
    { key: 'invoice', path: '/invoices', icon: 'fa-file-invoice', label: 'Invoices', show: true },
    { key: 'customer', path: '/customers', icon: 'fa-users', label: 'Customers', show: can('manageCustomers') },
    { key: 'reports', path: '/reports', icon: 'fa-chart-pie', label: 'Reports', show: can('viewReports') },
    { key: 'expense', path: '/expenses', icon: 'fa-wallet', label: 'Expenses', show: true }
  ];

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
          <button className="icon-btn nav-theme-btn" onClick={toggleTheme} title="Toggle theme">
            <i className="fa-solid fa-moon"></i>
          </button>

          {/* Mobile notification bell */}
          <div className="nav-mobile-only" style={{ position: 'relative' }} ref={notifRef}>
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
          <Routes>
            <Route path="/home" element={<Home go={go} />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/items" element={can('manageItems') ? <Items /> : <Navigate to="/home" replace />} />
            <Route path="/customers" element={can('manageCustomers') ? <Customers /> : <Navigate to="/home" replace />} />
            <Route path="/reports" element={can('viewReports') ? <Reports /> : <Navigate to="/home" replace />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </main>
      </div>

      {/* MOBILE BOTTOM TAB BAR — hidden on desktop via CSS (@media max-width:1023px only) */}
      <nav className="mobile-tabbar">
        {navLinks.filter((l) => l.show).map((l) => (
          <button
            key={l.key}
            className={'mobile-tab' + (currentPath === l.path ? ' active' : '')}
            onClick={() => go(l.key)}
          >
            <i className={'fa-solid ' + l.icon}></i>
            <span>{l.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}