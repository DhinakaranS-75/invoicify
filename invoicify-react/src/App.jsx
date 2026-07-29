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
import IdleWarning from './components/IdleWarning';
import InstallPrompt from './components/InstallPrompt';

function Root() {
  const { currentUser, booting } = useData();
  const { pathname } = useLocation();

  // Team invitation links (/invite/<token>) always open the accept page,
  // whether or not someone is already logged in on this device.
  if (/^\/invite\/.+/.test(pathname)) return <InviteAccept />;

  // While checking if a saved login is still valid
  if (booting) return <BootSplash />;

  // Not logged in:
  //   /login, /signup, /forgot, /reset -> the auth screens
  //   anything else (including /) -> the public landing page
  if (!currentUser) {
    const authPaths = ['/login', '/signup', '/forgot', '/reset'];
    if (authPaths.some((pth) => pathname.startsWith(pth))) return <AuthScreen />;
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
