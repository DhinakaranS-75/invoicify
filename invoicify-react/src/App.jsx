import { useData } from './context/DataContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import AuthScreen from './pages/AuthScreen';
import AppShell from './components/AppShell';
import Onboarding from './pages/Onboarding';
import BootSplash from './components/BootSplash';

function Root() {
  const { currentUser, booting } = useData();

  // While checking if a saved login is still valid
  if (booting) return <BootSplash />;

  // Not logged in -> auth screens
  if (!currentUser) return <AuthScreen />;

  // Logged in but hasn't completed company onboarding -> onboarding
  if (!currentUser.onboarded) return <Onboarding />;

  // Logged in and onboarded -> main app
  return <AppShell />;
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
