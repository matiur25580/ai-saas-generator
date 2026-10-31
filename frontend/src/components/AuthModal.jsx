import React, { useState, useRef } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://ai-saas-generator-d3g8.onrender.com';

function OtpBoxes({ value, onChange }) {
  const refs = useRef([]);
  const handleChange = (i, v) => {
    if (!/^\d*$/.test(v)) return;
    const arr = [...value];
    arr[i] = v.slice(-1);
    onChange(arr);
    if (v && i < 5 && refs.current[i + 1]) refs.current[i + 1].focus();
  };
  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0 && refs.current[i - 1]) refs.current[i - 1].focus();
  };
  const handlePaste = (e) => {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (t.length) {
      e.preventDefault();
      onChange(t.split(''));
      setTimeout(() => { if (refs.current[Math.min(t.length, 5)]) refs.current[Math.min(t.length, 5)].focus(); }, 0);
    }
  };
  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '6px 0 12px' }} onPaste={handlePaste}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input key={i} ref={(el) => (refs.current[i] = el)}
          value={value[i] || ''} onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)} inputMode="numeric" maxLength={1}
          style={{ width: '42px', height: '50px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#fff', outline: 'none' }} />
      ))}
    </div>
  );
}

export default function AuthModal({ themeStyles, onClose, onLogin }) {
  const [step, setStep] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [otp, setOtp] = useState([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const ts = themeStyles || {};
  const inputS = { width: '100%', padding: '10px', background: ts.inputBg || '#1e293b', color: ts.inputColor || '#fff', border: '1px solid ' + (ts.border || '#475569'), borderRadius: '6px', boxSizing: 'border-box', fontSize: '13px', marginBottom: '10px' };
  const btnFull = { background: '#6366f1', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '8px' };
  const btnSmall = { background: '#6366f1', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' };
  const btnDanger = { background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' };
  const linkS = { fontSize: '12px', color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', padding: '0' };

  const go = (s) => { setStep(s); setError(''); setInfo(''); };
  const post = async (path, body) => {
    const r = await fetch(BACKEND + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  };
  const resend = async (purpose) => {
    setError(''); setLoading(true);
    try {
      const d = await post('/api/auth/send-otp', { email, name, purpose });
      if (!d.success) { setError(d.error || 'Failed'); return; }
      setInfo('📩 OTP resent! Check your email.');
    } catch { setError('Backend connection failed'); } finally { setLoading(false); }
  };

  const doLogin = async (e) => {
    e.preventDefault(); setError('');
    if (!email.trim()) return setError('Please enter email');
    if (!password) return setError('Please enter password');
    setLoading(true);
    try {
      const d = await post('/api/auth/login', { email, password });
      if (!d.success) { setError(d.error || 'Login failed'); return; }
      onLogin(d.user, d.token);
    } catch { setError('Backend connection failed'); } finally { setLoading(false); }
  };

  const doSignup = async (e) => {
    e.preventDefault(); setError('');
    if (!name.trim()) return setError('Please enter full name');
    if (!email.trim()) return setError('Please enter email');
    setLoading(true);
    try {
      const d = await post('/api/auth/send-otp', { email, name, purpose: 'signup' });
      if (!d.success) { setError(d.error || 'Failed to send OTP'); return; }
      setOtp([]); setPassword(''); setConfirm('');
      setInfo('📩 6-digit OTP sent to your email (valid 5 min)');
      go('signup-otp');
    } catch { setError('Backend connection failed'); } finally { setLoading(false); }
  };

  const doVerifySignup = async (e) => {
    e.preventDefault(); setError('');
    const code = otp.join('');
    if (code.length !== 6) return setError('Please enter the 6-digit OTP');
    if (!password) return setError('Please set a password');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirm) return setError('Passwords do not match');
    setLoading(true);
    try {
      const d = await post('/api/auth/register', { name, email, password, otp: code });
      if (!d.success) { setError(d.error || 'Registration failed'); return; }
      go('success');
    } catch { setError('Backend connection failed'); } finally { setLoading(false); }
  };

  const doForgot = async (e) => {
    e.preventDefault(); setError('');
    if (!email.trim()) return setError('Please enter email');
    setLoading(true);
    try {
      const d = await post('/api/auth/send-otp', { email, purpose: 'reset' });
      if (!d.success) { setError(d.error || 'Failed to send OTP'); return; }
      setOtp([]); setPassword(''); setConfirm('');
      setInfo('📩 6-digit OTP sent to your email (valid 5 min)');
      go('forgot-otp');
    } catch { setError('Backend connection failed'); } finally { setLoading(false); }
  };

  const doReset = async (e) => {
    e.preventDefault(); setError('');
    const code = otp.join('');
    if (code.length !== 6) return setError('Please enter the 6-digit OTP');
    if (!password) return setError('Please enter new password');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirm) return setError('Passwords do not match');
    setLoading(true);
    try {
      const d = await post('/api/auth/reset-password', { email, otp: code, newPassword: password });
      if (!d.success) { setError(d.error || 'Reset failed'); return; }
      go('reset-success');
    } catch { setError('Backend connection failed'); } finally { setLoading(false); }
  };

  const titles = { login: 'Login', signup: 'Sign Up', 'signup-otp': 'Verify Email', success: '🎉 Successfully Registered!', forgot: 'Forgot Password', 'forgot-otp': 'Reset Password', 'reset-success': '✅ Password Reset!' };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '15px' }}>
      <div style={{ background: ts.cardBg || '#1e293b', border: '1px solid ' + (ts.border || '#475569'), borderRadius: '12px', padding: '20px', width: '100%', maxWidth: '400px', maxHeight: '92vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '17px' }}>{titles[step]}</h3>
        {error && <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', marginBottom: '10px' }}>{error}</div>}
        {info && <div style={{ background: '#1e3a5f', color: '#bae6fd', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', marginBottom: '10px' }}>{info}</div>}

        {step === 'login' && (
          <form onSubmit={doLogin}>
            <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} style={inputS} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputS} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <button type="button" onClick={() => go('signup')} style={linkS}>Don't have an account? Sign Up</button>
              <button type="button" onClick={() => go('forgot')} style={linkS}>Forgot password?</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={onClose} style={btnDanger}>Cancel</button>
              <button type="submit" disabled={loading} style={btnSmall}>{loading ? 'Please wait...' : 'Login'}</button>
            </div>
          </form>
        )}

        {step === 'signup' && (
          <form onSubmit={doSignup}>
            <input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} style={inputS} />
            <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} style={inputS} />
            <button type="button" onClick={() => go('login')} style={{ ...linkS, display: 'block', marginBottom: '14px' }}>Already have an account? Login</button>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={onClose} style={btnDanger}>Cancel</button>
              <button type="submit" disabled={loading} style={btnSmall}>{loading ? 'Sending OTP...' : 'Submit'}</button>
            </div>
          </form>
        )}

        {step === 'signup-otp' && (
          <form onSubmit={doVerifySignup}>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 4px' }}>Enter the OTP sent to <b>{email}</b></p>
            <OtpBoxes value={otp} onChange={setOtp} />
            <input type="password" placeholder="Set password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} style={inputS} />
            <input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputS} />
            <button type="submit" disabled={loading} style={btnFull}>{loading ? 'Verifying...' : 'Verify & Create Account'}</button>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => resend('signup')} style={linkS}>Resend OTP</button>
              <button type="button" onClick={() => go('signup')} style={linkS}>← Back</button>
            </div>
          </form>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '44px', marginBottom: '8px' }}>🎉</div>
            <p style={{ fontSize: '14px', color: '#86efac', marginBottom: '16px' }}>Successfully registered!<br />Please login with your email and password.</p>
            <button onClick={() => { setPassword(''); setConfirm(''); setOtp([]); go('login'); }} style={btnFull}>Back to Login</button>
          </div>
        )}

        {step === 'forgot' && (
          <form onSubmit={doForgot}>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 8px' }}>Enter your registered email to receive a reset OTP.</p>
            <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} style={inputS} />
            <button type="submit" disabled={loading} style={btnFull}>{loading ? 'Sending OTP...' : 'Send OTP'}</button>
            <button type="button" onClick={() => go('login')} style={{ ...linkS, display: 'block', textAlign: 'center', width: '100%' }}>← Back to Login</button>
          </form>
        )}

        {step === 'forgot-otp' && (
          <form onSubmit={doReset}>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 4px' }}>Enter the OTP sent to <b>{email}</b></p>
            <OtpBoxes value={otp} onChange={setOtp} />
            <input type="password" placeholder="New password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} style={inputS} />
            <input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputS} />
            <button type="submit" disabled={loading} style={btnFull}>{loading ? 'Resetting...' : 'Reset Password'}</button>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => resend('reset')} style={linkS}>Resend OTP</button>
              <button type="button" onClick={() => go('forgot')} style={linkS}>← Back</button>
            </div>
          </form>
        )}

        {step === 'reset-success' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '44px', marginBottom: '8px' }}>✅</div>
            <p style={{ fontSize: '14px', color: '#86efac', marginBottom: '16px' }}>Password reset successfully!<br />Please login with your new password.</p>
            <button onClick={() => { setPassword(''); setConfirm(''); setOtp([]); go('login'); }} style={btnFull}>Back to Login</button>
          </div>
        )}

      </div>
    </div>
  );
}
