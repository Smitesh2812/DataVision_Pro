// pages/AuthPage.jsx
// Combined Login + Register page.
// Toggles between two forms based on `mode` prop.

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const DEMO_ACCOUNTS = [
  { label: '🟣 Admin',   email: 'admin@datavision.pro', pass: 'admin123', role: 'Enterprise' },
  { label: '🔵 Demo',    email: 'demo@datavision.pro',  pass: 'demo123',  role: 'Free' },
];

export default function AuthPage({ mode = 'login' }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab]         = useState(mode); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Login form state
  const [loginData, setLoginData] = useState({ email: '', password: '' });

  // Register form state
  const [regData, setRegData] = useState({
    firstName: '', lastName: '', company: '', email: '', password: ''
  });

  // ── LOGIN SUBMIT ─────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(loginData.email, loginData.password);
      toast.success('Welcome back! 👋');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // ── REGISTER SUBMIT ──────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await register(regData);
      toast.success(`Welcome, ${regData.firstName}! 🎉`);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email, pass) => {
    setLoginData({ email, password: pass });
    setTab('login');
    setError('');
  };

  return (
    <div style={styles.page}>
      {/* Left decorative panel */}
      <div style={styles.left}>
        <div style={styles.leftContent}>
          <div style={styles.brand}>
            <div style={styles.brandIcon}>📊</div>
            <h1 style={styles.brandName}>
              Data<span style={{ color: '#5b8ff9' }}>Vision</span> Pro
            </h1>
            <p style={styles.brandSub}>Enterprise Analytics Platform</p>
          </div>
          <div style={styles.perks}>
            {[
              ['📈', 'Instant Charts', '30+ visualization types auto-generated'],
              ['🔍', 'AI Insights',    'Correlation, outliers, statistics'],
              ['🧹', 'Data Cleaning',  '9 one-click cleaning operations'],
              ['🔐', 'Secure Auth',    'JWT + bcrypt, sessions in PostgreSQL'],
            ].map(([icon, title, desc]) => (
              <div key={title} style={styles.perk}>
                <div style={styles.perkIcon}>{icon}</div>
                <div>
                  <div style={styles.perkTitle}>{title}</div>
                  <div style={styles.perkDesc}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={styles.leftGlow} />
      </div>

      {/* Right form panel */}
      <div style={styles.right}>
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>
            {tab === 'login' ? 'Welcome back 👋' : 'Create your account'}
          </h2>
          <p style={styles.formSub}>
            {tab === 'login' ? 'Sign in to your workspace' : 'Free forever · No credit card needed'}
          </p>

          {/* Tab switcher */}
          <div style={styles.tabRow}>
            {['login','register'].map(t => (
              <button
                key={t}
                style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
                onClick={() => { setTab(t); setError(''); }}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Error message */}
          {error && <div style={styles.error}>{error}</div>}

          {/* LOGIN FORM */}
          {tab === 'login' && (
            <form onSubmit={handleLogin}>
              <Field label="Email" type="email" value={loginData.email}
                onChange={v => setLoginData(p => ({ ...p, email: v }))}
                placeholder="you@company.com" />
              <Field label="Password" type="password" value={loginData.password}
                onChange={v => setLoginData(p => ({ ...p, password: v }))}
                placeholder="••••••••" />
              <button type="submit" style={styles.submitBtn} disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In →'}
              </button>

              <div style={styles.divider}><span>or try a demo account</span></div>
              <div style={styles.demoGrid}>
                {DEMO_ACCOUNTS.map(a => (
                  <button key={a.email} type="button" style={styles.demoBtn}
                    onClick={() => fillDemo(a.email, a.pass)}>
                    <strong style={{ display: 'block', fontSize: 12 }}>{a.label}</strong>
                    <span style={{ fontSize: 10, color: '#6b7280' }}>{a.role}</span>
                  </button>
                ))}
              </div>
            </form>
          )}

          {/* REGISTER FORM */}
          {tab === 'register' && (
            <form onSubmit={handleRegister}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="First Name *" value={regData.firstName}
                  onChange={v => setRegData(p => ({ ...p, firstName: v }))} placeholder="Rahul" />
                <Field label="Last Name" value={regData.lastName}
                  onChange={v => setRegData(p => ({ ...p, lastName: v }))} placeholder="Sharma" />
              </div>
              <Field label="Company" value={regData.company}
                onChange={v => setRegData(p => ({ ...p, company: v }))} placeholder="Your company name" />
              <Field label="Email *" type="email" value={regData.email}
                onChange={v => setRegData(p => ({ ...p, email: v }))} placeholder="you@company.com" />
              <Field label="Password * (min 6 chars)" type="password" value={regData.password}
                onChange={v => setRegData(p => ({ ...p, password: v }))} placeholder="Choose a strong password" />
              <button type="submit" style={styles.submitBtn} disabled={loading}>
                {loading ? 'Creating account…' : 'Create Free Account →'}
              </button>
              <p style={{ textAlign: 'center', fontSize: 11, color: '#6b7280', marginTop: 10 }}>
                By signing up you agree to our Terms of Service
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// Reusable form field component
function Field({ label, type = 'text', value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder} required
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #2a2f4a',
          background: '#10131f', color: '#eef0fa', fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
          outline: 'none', boxSizing: 'border-box' }}
        onFocus={e => { e.target.style.borderColor = '#5b8ff9'; e.target.style.boxShadow = '0 0 0 3px rgba(91,143,249,0.12)'; }}
        onBlur={e => { e.target.style.borderColor = '#2a2f4a'; e.target.style.boxShadow = 'none'; }}
      />
    </div>
  );
}

const styles = {
  page:        { display: 'flex', minHeight: '100vh', background: '#05060b', fontFamily: "'Outfit', sans-serif" },
  left:        { flex: 1, background: 'linear-gradient(145deg,#0d1236,#1a1060,#0a0f2e)', padding: 56, display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  leftContent: { position: 'relative', zIndex: 1 },
  brand:       { marginBottom: 40 },
  brandIcon:   { fontSize: 40, marginBottom: 12 },
  brandName:   { fontSize: 32, fontWeight: 800, letterSpacing: -1, color: '#eef0fa', margin: 0 },
  brandSub:    { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono',monospace", marginTop: 6 },
  perks:       { display: 'flex', flexDirection: 'column', gap: 20 },
  perk:        { display: 'flex', gap: 14, alignItems: 'flex-start' },
  perkIcon:    { width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  perkTitle:   { fontSize: 13, fontWeight: 700, color: '#eef0fa' },
  perkDesc:    { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono',monospace", marginTop: 3 },
  leftGlow:    { position: 'absolute', bottom: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(124,107,245,0.3),transparent 70%)' },
  right:       { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 },
  formCard:    { background: '#0c0e18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 40, width: '100%', maxWidth: 420 },
  formTitle:   { fontSize: 22, fontWeight: 700, color: '#eef0fa', margin: '0 0 4px' },
  formSub:     { fontSize: 12, color: '#6b7280', fontFamily: "'JetBrains Mono',monospace", marginBottom: 24 },
  tabRow:      { display: 'flex', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 },
  tab:         { flex: 1, padding: 9, textAlign: 'center', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: 'none', color: '#4d5577', fontFamily: "'Outfit',sans-serif", transition: 'all .2s' },
  tabActive:   { background: '#5b8ff9', color: 'white' },
  error:       { background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.3)', color: '#fb7185', fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: '10px 14px', borderRadius: 8, marginBottom: 14 },
  submitBtn:   { width: '100%', padding: 13, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#5b8ff9,#7c6bf5)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", marginTop: 4 },
  divider:     { display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0', fontSize: 11, color: '#4d5577', fontFamily: "'JetBrains Mono',monospace' }" },
  demoGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  demoBtn:     { padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#10131f', color: '#eef0fa', cursor: 'pointer', textAlign: 'center', fontFamily: "'Outfit',sans-serif", transition: 'all .2s' },
};
