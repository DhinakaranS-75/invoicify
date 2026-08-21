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

function Root() {
  const { currentUser, booting } = useData();
  const { pathname } = useLocation();

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

    const isInstalledApp =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true; // iOS Safari "Add to Home Screen"
    if (isInstalledApp) return <AuthScreen />;

    return <Landing />;
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