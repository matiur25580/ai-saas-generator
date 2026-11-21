import React, { lazy, Suspense, useEffect, useState } from 'react';
import AuthModal from './components/AuthDialog';
import ErrorBoundary from './components/ErrorBoundary';
import { apiFetch, refreshSession, setAccessToken, setCsrfToken, clearAccessToken } from './api';

const Landing = lazy(() => import('./pages/Landing'));
const Studio = lazy(() => import('./components/Studio'));
const Admin = lazy(() => import('./pages/AdminPanel'));

function LoadingScreen() {
  return <main className="app-loading" aria-label="Loading application"><span className="loading-orbit" /></main>;
}

export default function AppShell() {
  const [view, setView] = useState('landing');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [user, setUser] = useState('');
  const [credits, setCredits] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [sessionError, setSessionError] = useState('');

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
    }).catch(() => {
      if (active) setSessionError('Your previous session could not be verified. Check your connection and try again.');
    });
    return () => { active = false; };
  }, []);

  const acceptLogin = (account, token, csrfToken, destination = 'studio') => {
    setAccessToken(token);
    setCsrfToken(csrfToken);
    setUser(account.email);
    setCredits(account.credits);
    setAuthOpen(false);
    setView(destination);
    setSessionError('');
  };

  const signOut = async () => {
    try {
      const response = await apiFetch('/api/auth/logout', { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'The server could not revoke this session.');
      }
    } catch {
      setSessionError('Sign out could not be confirmed. Check your connection and try again.');
      return;
    }
    clearAccessToken();
    setUser('');
    setCredits(0);
    setView('landing');
  };

  const sessionExpired = () => {
    clearAccessToken();
    setUser('');
    setCredits(0);
  };

  return (
    <ErrorBoundary>
      <div className="app-shell" data-theme={theme}>
        {sessionError && <div className="inline-alert session-alert" role="alert"><span>{sessionError}</span><button onClick={() => setSessionError('')} aria-label="Dismiss error">×</button></div>}
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
          {view === 'admin' && <Admin onBack={() => setView('studio')} onLogin={(account, token, csrfToken) => acceptLogin(account, token, csrfToken, 'admin')} />}
        </Suspense>
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onLogin={acceptLogin} />}
      </div>
    </ErrorBoundary>
  );
}
