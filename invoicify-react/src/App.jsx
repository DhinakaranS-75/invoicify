import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from './context/DataContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import AuthScreen from './pages/AuthScreen';
import AppShell from './components/AppShell';
import Onboarding from './pages/Onboarding';
import BootSplash from './components/BootSplash';
import InviteAccept from './pages/InviteAccept';
import Landing from './pages/Landing';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import IdleWarning from './components/IdleWarning';
import InstallPrompt from './components/InstallPrompt';
import AppLockScreen from './components/AppLockScreen';
import { isAppLockEnabled } from './utils/appLock';

function Root() {
  const { currentUser, booting } = useData();
  const { pathname } = useLocation();
  const [isLocked, setIsLocked] = useState(false);
  const hasCheckedInitialLock = useRef(false);

  // Is this the installed app (PWA/TWA standalone), not just a regular
  // browser tab? App Lock only makes sense there — someone with the site
  // open in a browser tab shouldn't get PIN-locked every time they switch
  // tabs while working.
  const isInstalledApp =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true; // iOS Safari "Add to Home Screen"

  // App Lock: re-lock every time the installed app is opened or resumed
  // from the background — not just after the 10-minute idle timer, which
  // only fires while the app stays in the foreground the whole time.
  //
  // Two triggers:
  // 1. Cold start / boot-restored session — checked once, right after the
  //    initial "am I logged in?" check finishes. Deliberately does NOT
  //    fire for a fresh interactive login (someone who just typed their
  //    password a moment ago doesn't need a PIN too).
  // 2. Coming back from the background (visibilitychange) — covers the
  //    common case of switching apps and returning.
  useEffect(() => {
    if (booting || !isInstalledApp) return;
    if (!hasCheckedInitialLock.current) {
      hasCheckedInitialLock.current = true;
      if (currentUser && isAppLockEnabled()) setIsLocked(true);
    }
  }, [booting, currentUser, isInstalledApp]);

  useEffect(() => {
    if (!isInstalledApp) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && currentUser && isAppLockEnabled()) {
        setIsLocked(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [currentUser, isInstalledApp]);

  // Legal pages are public and don't depend on auth/boot state at all —
  // check them first so they're instant even before the login check runs.
  if (pathname === '/terms') return <Terms />;
  if (pathname === '/privacy') return <Privacy />;

  // Team invitation links (/invite/<token>) always open the accept page,
  // whether or not someone is already logged in on this device.
  if (/^\/invite\/.+/.test(pathname)) return <InviteAccept />;

  // While checking if a saved login is still valid
  if (booting) return <BootSplash />;

  // Not logged in:
  //   /login, /signup, /forgot, /reset -> the auth screens
  //   anything else in a normal browser tab -> the public landing page
  //   anything else in the installed app (PWA/TWA standalone) -> straight to login,
  //   since someone who already installed the app doesn't need the marketing pitch
  if (!currentUser) {
    const authPaths = ['/login', '/signup', '/forgot', '/reset'];
    if (authPaths.some((pth) => pathname.startsWith(pth))) return <AuthScreen />;
    if (isInstalledApp) return <AuthScreen />;
    return <Landing />;
  }

  // Logged in, but the App Lock PIN screen is covering the app right now.
  if (isLocked) {
    return (
      <div className="app-lock-screen">
        <AppLockScreen mode="unlock" onUnlock={() => setIsLocked(false)} />
      </div>
    );
  }

  // Logged in but hasn't completed company onboarding -> onboarding
  if (!currentUser.onboarded) return <><Onboarding /><IdleWarning /><InstallPrompt /></>;

  // Logged in and onboarded -> main app
  return <><AppShell /><IdleWarning /><InstallPrompt /></>;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <DataProvider>
          <Root />
        </DataProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
