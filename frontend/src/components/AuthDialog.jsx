import React, { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, LoaderCircle, Mail, X } from 'lucide-react';

const API = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '');

export default function AuthDialog({ onClose, onLogin }) {
  const [step, setStep] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [otp, setOtp] = useState('');
  const [seconds, setSeconds] = useState(180);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const otpStep = step === 'signup-otp' || step === 'reset-otp';

  useEffect(() => {
    if (!otpStep) return undefined;
    setSeconds(180);
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [otpStep, step]);

  useEffect(() => {
    const handleKeyDown = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  const request = async (path, payload) => {
    const response = await fetch(`${API}${path}`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.error || 'The request could not be completed.');
    return data;
  };

  const run = async (operation) => {
    setBusy(true);
    setError('');
    setNotice('');
    try { await operation(); }
    catch (requestError) { setError(requestError.message || 'The backend could not be reached.'); }
    finally { setBusy(false); }
  };

  const login = (event) => {
    event.preventDefault();
    run(async () => {
      const data = await request('/api/auth/login', { email, password });
      onLogin(data.user, data.token, data.csrfToken);
    });
  };

  const sendCode = (purpose) => run(async () => {
    const data = await request('/api/auth/send-otp', { email, name, purpose });
    setOtp('');
    setStep(purpose === 'signup' ? 'signup-otp' : 'reset-otp');
    setNotice(data.message || 'A verification code was sent to your email.');
  });

  const verifySignup = (event) => {
    event.preventDefault();
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    run(async () => {
      await request('/api/auth/register', { name, email, password, otp });
      setStep('login');
      setPassword('');
      setConfirmation('');
      setNotice('Your account is ready. Sign in with your new password.');
    });
  };

  const resetPassword = (event) => {
    event.preventDefault();
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    run(async () => {
      await request('/api/auth/reset-password', { email, otp, newPassword: password });
      setStep('login');
      setPassword('');
      setConfirmation('');
      setNotice('Password reset. Sign in with your new password.');
    });
  };

  const heading = {
    login: 'Welcome back', signup: 'Create your account', 'signup-otp': 'Verify your email',
    forgot: 'Reset your password', 'reset-otp': 'Choose a new password'
  }[step];
  const backToLogin = () => { setStep('login'); setError(''); setNotice(''); };

  return (
    <div className="auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div className="auth-dialog-top"><span className="brand-glyph">D</span><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Close"><X size={18} /></button></div>
        <span className="eyebrow">DRAFTLINE ACCOUNT</span>
        <h2 id="auth-title">{heading}</h2>
        <p>{step === 'login' ? 'Sign in to sync your history and account credits.' : step.includes('otp') ? `Enter the six-digit code sent to ${email}.` : 'Use your email to receive a secure verification code.'}</p>
        {error && <div className="auth-message" role="alert">{error}</div>}
        {notice && <div className="auth-message success" role="status">{notice}</div>}

        {step === 'login' && <form onSubmit={login}>
          <label className="auth-field">Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="auth-field">Password<input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <div className="auth-links"><button type="button" onClick={() => { setStep('signup'); setError(''); setNotice(''); }}>Create an account</button><button type="button" onClick={() => { setStep('forgot'); setError(''); setNotice(''); }}>Forgot password?</button></div>
          <button className="button button-primary auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <KeyRound size={16} />} Sign in</button>
        </form>}

        {step === 'signup' && <form onSubmit={(event) => { event.preventDefault(); sendCode('signup'); }}>
          <label className="auth-field">Name<input autoComplete="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="auth-field">Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <button className="button button-primary auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Mail size={16} />} Send verification code</button>
          <button className="auth-back-link" type="button" onClick={backToLogin}><ArrowLeft size={14} /> Back to sign in</button>
        </form>}

        {step === 'signup-otp' && <form onSubmit={verifySignup}>
          <label className="auth-field">Six-digit code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
          <label className="auth-field">Password (8-128 characters)<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label className="auth-field">Confirm password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          <button className="button button-primary auth-submit" disabled={busy || otp.length !== 6}>{busy ? <LoaderCircle className="spin" size={16} /> : <KeyRound size={16} />} Verify and create account</button>
          <div className="otp-footer"><span>Code expires in {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span><button type="button" disabled={busy || seconds > 0} onClick={() => sendCode('signup')}>Resend code</button></div>
        </form>}

        {step === 'forgot' && <form onSubmit={(event) => { event.preventDefault(); sendCode('reset'); }}>
          <label className="auth-field">Account email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <button className="button button-primary auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Mail size={16} />} Send reset code</button>
          <button className="auth-back-link" type="button" onClick={backToLogin}><ArrowLeft size={14} /> Back to sign in</button>
        </form>}

        {step === 'reset-otp' && <form onSubmit={resetPassword}>
          <label className="auth-field">Six-digit code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
          <label className="auth-field">New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label className="auth-field">Confirm new password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          <button className="button button-primary auth-submit" disabled={busy || otp.length !== 6}>{busy ? <LoaderCircle className="spin" size={16} /> : <KeyRound size={16} />} Reset password</button>
          <div className="otp-footer"><span>Code expires in {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span><button type="button" disabled={busy || seconds > 0} onClick={() => sendCode('reset')}>Resend code</button></div>
        </form>}
      </section>
    </div>
  );
}
