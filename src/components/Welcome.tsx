import { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';
import type { User } from '../lib/core.ts';
import { PLATFORM_BRAND } from '../lib/brand.ts';
import { applyBrand } from '../lib/core.ts';
import { BrandMark } from './BrandMark.tsx';
import { Segmented } from './ui.tsx';

export default function Welcome({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { applyBrand(PLATFORM_BRAND); }, []);

  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const res = mode === 'login'
        ? await api.login({ email, password })
        : await api.register({ email, password, name });
      onAuthed(res.user);
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="welcome">
      <div className="bgfx golf"><div className="blob g" /><div className="blob e" /></div>
      <div className="welcome-card">
        <div className="welcome-brand">
          <BrandMark variant="hero" brand={PLATFORM_BRAND} />
          <div className="welcome-brand-copy">
            <div className="wm">QuackedDialer</div>
            <div className="tag">Sales Performance OS</div>
          </div>
        </div>
        <h1>{mode === 'login' ? 'Back on the phones.' : 'Build your book.'}</h1>
        <p className="sub">
          Track dials, zones, and premium. Join your team and the app white-labels to them.
        </p>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'login', label: 'Sign in' },
            { value: 'register', label: 'Create account' },
          ]}
        />
        {mode === 'register' && (
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" autoComplete="email" inputMode="email" />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? 'At least 8 characters' : 'Password'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>
        <button className="btn primary wide" onClick={submit} disabled={busy || !email || !password}>
          {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        {error && <p className="err">{error}</p>}
      </div>
    </div>
  );
}
