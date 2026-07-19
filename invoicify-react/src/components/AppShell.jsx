import { useState, useCallback } from 'react';
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
import Settings from '../pages/Settings';

// Maps our internal page keys to URL paths
const PAGE_PATHS = {
  home: '/home', item: '/items', invoice: '/invoices',
  customer: '/customers', reports: '/reports', profile: '/settings'
};
const PATH_TITLES = {
  '/home': '', '/items': 'Items', '/invoices': 'Invoices',
  '/customers': 'Customers', '/reports': 'Reports', '/settings': 'Settings'
};

export default function AppShell() {
  const { currentUser, logout } = useData();
  const { toggleTheme } = useTheme();
  const { can, role } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

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
    { key: 'reports', path: '/reports', icon: 'fa-chart-pie', label: 'Reports', show: can('viewReports') }
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
            <button className="icon-btn" onClick={() => setNotifOpen((o) => !o)} title="Notifications">
              <i className="fa-solid fa-bell"></i>
            </button>
            {notifOpen && (
              <div className="notif-dropdown show">
                <div className="notif-head">Notifications</div>
                <div className="notif-list">
                  <div className="notif-empty">You're all caught up!</div>
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
