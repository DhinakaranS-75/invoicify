// Full-page "More" screen for mobile. Receives its link list, the shared
// go(key) navigator, and light user/company context from AppShell (which
// already owns all of this for the top-nav profile dropdown).

// Per-link color + one-line description, keyed by nav link `key`. Colors
// pull from the same palette used across the app's dashboard cards.
const LINK_META = {
  customer: { color: 'var(--teal)', sub: 'Manage your customer list' },
  reports: { color: 'var(--pink)', sub: 'Income, expenses & profit' },
  expense: { color: 'var(--danger)', sub: 'Track what you spend' },
  profile: { color: 'var(--navy)', sub: 'Company & account preferences' }
};

export default function MoreMenu({ links, go, currentUser, company }) {
  const initial = (currentUser?.name || 'U').trim().charAt(0).toUpperCase();

  return (
    <div className="page active">
      <div className="app-header-row">
        <div><h1 className="hide-mobile">More</h1><p className="hide-mobile">Everything else, in one place.</p></div>
      </div>

      <div className="more-profile-card">
        <div className="more-profile-avatar">
          {currentUser?.avatar ? <img src={currentUser.avatar} alt="me" /> : initial}
        </div>
        <div className="more-profile-text">
          <div className="more-profile-name">{currentUser?.name || 'Your account'}</div>
          <div className="more-profile-company">{company?.name || 'Invoicify'}</div>
        </div>
      </div>

      <div className="more-menu-list">
        {links.map((l) => {
          const meta = LINK_META[l.key] || { color: 'var(--navy)', sub: '' };
          return (
            <button key={l.key} className="more-menu-row" onClick={() => go(l.key)}>
              <span className="more-menu-badge" style={{ background: meta.color }}>
                <i className={'fa-solid ' + l.icon}></i>
              </span>
              <span className="more-menu-text">
                <span className="more-menu-title">{l.label}</span>
                {meta.sub && <span className="more-menu-sub">{meta.sub}</span>}
              </span>
              <i className="fa-solid fa-chevron-right tab-chevron"></i>
            </button>
          );
        })}
      </div>
    </div>
  );
}