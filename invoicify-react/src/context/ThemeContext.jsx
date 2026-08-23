import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'invoicify_theme_mode'; // saved value: 'light' | 'dark' | 'system'

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

export function ThemeProvider({ children }) {
  // `mode` is what the user picked ('light' | 'dark' | 'system').
  // `theme` (below) is what's actually applied — for 'system' that follows
  // the OS setting and updates live if the person flips it while the app
  // is open.
  const [mode, setModeRaw] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'system';
    } catch {
      return 'system';
    }
  });
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemDark(e.matches);
    mql.addEventListener?.('change', handler);
    return () => mql.removeEventListener?.('change', handler);
  }, []);

  const theme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setMode = useCallback((next) => {
    setModeRaw(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private-browsing / storage-disabled — theme just won't persist, which is fine.
    }
  }, []);

  // Simple light/dark flip, kept for any existing quick-toggle buttons.
  // Explicitly choosing light or dark this way opts out of "System".
  const toggleTheme = useCallback(() => {
    setMode(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setMode]);

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
