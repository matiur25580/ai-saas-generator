import React, { lazy, Suspense, useEffect, useState } from 'react';
import AuthModal from './components/AuthDialog';
import ErrorBoundary from './components/ErrorBoundary';
import { refreshSession } from './api';

const Landing = lazy(() => import('./pages/Landing'));
const Studio = lazy(() => import('./components/Studio'));
const Admin = lazy(() => import('./pages/AdminPanel'));

function LoadingScreen() {
  return <main className="app-loading" aria-label="Loading application"><span className="loading-orbit" /></main>;
}

export default function AppShell() {
  const [view, setView] = useState('landing');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [user, setUser] = useState(() => localStorage.getItem('loggedInUser') || '');
  const [credits, setCredits] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    let active = true;
    refreshSession().then((session) => {
      if (!active) return;
      if (!session) {
        setUser('');
        setCredits(0);
        return;
      }
      setUser(session.email);
      setCredits(session.credits);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const acceptLogin = (account, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('loggedInUser', account.email);
    setUser(account.email);
    setCredits(account.credits);
    setAuthOpen(false);
    setView('studio');
  };

  const signOut = async () => {
    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '')}/api/auth/logout`, {
        method: 'POST', credentials: 'include'
      });
    } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('loggedInUser');
    setUser('');
    setCredits(0);
    setView('landing');
  };

  const sessionExpired = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('loggedInUser');
    setUser('');
    setCredits(0);
  };

  return (
    <ErrorBoundary>
      <div className="app-shell" data-theme={theme}>
        <Suspense fallback={<LoadingScreen />}>
          {view === 'landing' && <Landing onOpenStudio={() => setView('studio')} onLogin={() => setAuthOpen(true)} />}
          {view === 'studio' && (
            <Studio
              user={user}
              credits={credits}
              setCredits={setCredits}
              onLogin={() => setAuthOpen(true)}
              onLogout={signOut}
              onSessionExpired={sessionExpired}
              onOpenAdmin={() => setView('admin')}
              theme={theme}
              onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
              onHome={() => setView('landing')}
            />
          )}
          {view === 'admin' && <Admin onBack={() => setView('studio')} />}
        </Suspense>
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onLogin={acceptLogin} />}
      </div>
    </ErrorBoundary>
  );
}
