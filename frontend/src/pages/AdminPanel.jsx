import React, { useEffect, useState } from 'react';
import { ArrowLeft, CircleAlert, Coins, LoaderCircle, LogIn, Users, WandSparkles } from 'lucide-react';
import { apiFetch } from '../api';

const API = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '');

export default function AdminPanel({ onBack, onLogin }) {
  const [data, setData] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [amount, setAmount] = useState('25');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);

  const loadStats = async () => {
    setBusy(true);
    try {
      const response = await apiFetch('/api/admin/stats');
      const result = await response.json();
      if (response.status === 401) { setNeedLogin(true); return; }
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not load admin data.');
      setData(result);
      setNeedLogin(false);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  useEffect(() => { loadStats(); }, []);

  const login = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Sign in failed.');
      onLogin(result.user, result.token);
      setNeedLogin(false);
      await loadStats();
    } catch (requestError) { setError(requestError.message || 'Could not connect to the backend.'); }
    finally { setBusy(false); }
  };

  const grantCredits = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch('/api/admin/add-credits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, credits: Number(amount) })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Credit grant failed.');
      setNotice(result.message);
      setTargetEmail('');
      await loadStats();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  return (
    <main className="admin-page">
      <header className="admin-header"><button className="button button-quiet" onClick={onBack}><ArrowLeft size={16} /> Back to studio</button><span className="eyebrow">DRAFTLINE / ADMINISTRATION</span></header>
      {needLogin ? <section className="admin-login"><span className="admin-mark"><LogIn size={22} /></span><span className="eyebrow">RESTRICTED AREA</span><h1>Administrator sign in</h1><p>Use an account with the administrator role.</p>{error && <div className="inline-alert" role="alert"><CircleAlert size={17} />{error}</div>}<form onSubmit={login}><label className="auth-field">Email<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="auth-field">Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button button-primary auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <LogIn size={16} />} Sign in</button></form></section> : !data && busy ? <section className="admin-loading"><LoaderCircle className="spin" size={20} /> Loading account data</section> : <section className="admin-content"><div className="admin-title"><div><span className="eyebrow">OPERATIONS</span><h1>Account overview</h1><p>Real account and generation records from the backend.</p></div><button className="button button-quiet" onClick={loadStats} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : 'Refresh data'}</button></div>{error && <div className="inline-alert" role="alert"><CircleAlert size={17} />{error}</div>}{notice && <div className="auth-message success" role="status">{notice}</div>}{data && <><div className="admin-metrics"><article><Users size={20} /><span>Total accounts</span><strong>{data.stats.totalUsers}</strong></article><article><WandSparkles size={20} /><span>Saved generations</span><strong>{data.stats.totalGenerations}</strong></article></div><form className="credit-grant" onSubmit={grantCredits}><div><span className="eyebrow">MANUAL CREDIT GRANT</span><h2>Adjust an account balance</h2><p>Every grant is recorded in the user’s credit ledger.</p></div><label className="field-label">Account email<input type="email" required maxLength={254} value={targetEmail} onChange={(event) => setTargetEmail(event.target.value)} /></label><label className="field-label">Credits<input type="number" min="1" max="100000" step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label><button className="button button-primary" disabled={busy || !targetEmail}><Coins size={16} /> Add credits</button></form><section className="admin-table-section"><h2>Recent accounts</h2>{data.recentUsers.length ? <div className="admin-table"><div className="admin-table-head"><span>Account</span><span>Role</span><span>Credits</span><span>Joined</span></div>{data.recentUsers.map((account) => <div className="admin-table-row" key={account._id}><span><b>{account.name}</b><small>{account.email}</small></span><span>{account.role}</span><strong>{account.credits}</strong><time>{new Date(account.createdAt).toLocaleDateString()}</time></div>)}</div> : <p className="muted-copy">No accounts have registered yet.</p>}</section></>}</section>}
    </main>
  );
}
