import { useState } from 'react';
import { api } from '../lib/api.ts';
import type { User } from '../lib/core.ts';
import { Segmented } from './ui.tsx';

export default function Welcome({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
      <div className="bgfx"><div className="blob g" /><div className="blob e" /><div className="grain" /></div>
      <div className="welcome-card">
        <div className="welcome-mark">
          <span className="mk">AS</span>
          <div>
            <div className="wm">ASCEND</div>
            <div className="tag">Sales Performance OS</div>
          </div>
        </div>
        <h1>{mode === 'login' ? 'Back on the phones.' : 'Build your book.'}</h1>
        <p className="sub">Track dials, zones, and premium. Team white-label. Your numbers, your agency.</p>
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
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? 'At least 8 characters' : 'Password'}
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
