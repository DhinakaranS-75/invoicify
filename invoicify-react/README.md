# Invoicify — React Edition

Professional invoice generator, converted from the single-file HTML app into a proper
Vite + React project.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server (opens http://localhost:5173)
npm run dev
```

## Project structure

```
invoicify/
├── index.html              # Entry HTML (fonts + Font Awesome CDN)
├── package.json            # Dependencies & scripts
├── vite.config.js          # Vite config
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Root: providers + auth/app routing
    ├── styles/
    │   └── app.css         # All styles (same design as the HTML app)
    ├── context/
    │   ├── DataContext.jsx     # App-wide state (users, invoices, customers…)
    │   ├── ThemeContext.jsx    # Light/dark theme
    │   └── ToastContext.jsx    # Toast notifications
    ├── hooks/
    │   └── usePermissions.js   # Role-based permission checks
    ├── utils/
    │   ├── format.js           # Currency, number-to-words, roles
    │   └── invoiceNumber.js    # Invoice number builder
    ├── components/
    │   └── AppShell.jsx        # Navbar + sidebar + page routing
    └── pages/
        ├── AuthScreen.jsx      # Login / Register / Forgot / Reset  ✅
        ├── Onboarding.jsx      # Company setup  ✅
        ├── Home.jsx            # Dashboard  (being built)
        ├── Invoices.jsx        # Invoice list + detail + form  (being built)
        ├── Items.jsx           # Item catalog  (being built)
        ├── Customers.jsx       # Customer list  (being built)
        ├── Reports.jsx         # Reports  (being built)
        └── Settings.jsx        # Tabbed settings  (being built)
```

## Conversion status

**Done (core setup):**
- Vite + React project scaffold
- All styles migrated (identical design)
- State management via React Context (Data, Theme, Toast)
- Role-based permissions hook
- Auth flow (login, register with role, forgot/reset)
- Company onboarding
- App shell: navbar, sidebar, page routing, profile dropdown, mobile responsive nav

**Next (feature pages):**
- Home dashboard (stats + charts)
- Invoices (dashboard, detail view, form, templates, PDF, payments)
- Items & Customers
- Reports
- Settings (profile, company, preferences, templates, team members)

Data is kept in memory for now (resets on refresh) — the backend + database
comes after the frontend conversion is complete.
