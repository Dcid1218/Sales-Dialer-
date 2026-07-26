import { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';
import type { Team, User } from '../lib/core.ts';
import { BrandMark } from './BrandMark.tsx';
import { PLATFORM_BRAND } from '../lib/brand.ts';
import { applyBrand } from '../lib/core.ts';

export default function Onboarding({ user, onDone }: { user: User; onDone: (u: User) => void }) {
  const [step, setStep] = useState(0);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState(user.team_id || '');
  const [name, setName] = useState(user.name || '');
  const [annual, setAnnual] = useState(150000);
  const [comm, setComm] = useState(75);
  const [dialGoal, setDialGoal] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    applyBrand(PLATFORM_BRAND);
    api.teams().then((r) => setTeams(r.teams)).catch(() => {});
  }, []);

  async function finish() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (!teamId && !user.team_id) throw new Error('Pick a team to join.');
      const { user: next } = await api.updateMe({
        name: name.trim() || user.email.split('@')[0],
        team_id: teamId || undefined,
        onboarded: true,
      });
      await api.saveSettings({ annual, comm, dialGoal, workdays: 6 });
      onDone(next);
    } catch (e: any) {
      setError(e.message || 'Could not finish.');
      setBusy(false);
    }
  }

  return (
    <div className="welcome">
      <div className="bgfx golf"><div className="blob g" /><div className="blob e" /><div className="grain" /></div>
      <div className="welcome-card onboard">
        <div className="welcome-mark" style={{ marginBottom: 12 }}>
          <BrandMark variant="tile" brand={PLATFORM_BRAND} />
          <div className="wm" style={{ fontSize: 18 }}>QuackedDialer</div>
        </div>
        <div className="steps">{[0, 1, 2].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>

        {step === 0 && (
          <>
            <h1>Who are you?</h1>
            <p className="sub">Display name on leaderboards and your team board.</p>
            <label className="field"><span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>
            <button className="btn primary wide" disabled={!name.trim()} onClick={() => setStep(1)}>Continue</button>
          </>
        )}

        {step === 1 && (
          <>
            <h1>Join your team</h1>
            <p className="sub">White-labels the tracker to your agency. Pick carefully.</p>
            <div className="team-grid">
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`team-card ${teamId === t.id ? 'on' : ''}`}
                  onClick={() => setTeamId(t.id)}
                  style={{
                    ['--tp' as any]: t.brand?.primary || '#C4A35A',
                    ['--ta' as any]: t.brand?.accent || '#0B5C3B',
                  }}
                >
                  <BrandMark brand={t.brand} variant="tile" />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
            <button className="btn primary wide" disabled={!teamId} onClick={() => setStep(2)}>Continue</button>
          </>
        )}

        {step === 2 && (
          <>
            <h1>Set your targets</h1>
            <p className="sub">You can change these anytime in Profile.</p>
            <div className="grid2">
              <label className="field"><span>Annual income goal</span>
                <input type="number" value={annual} onChange={(e) => setAnnual(+e.target.value || 0)} />
              </label>
              <label className="field"><span>Commission %</span>
                <input type="number" value={comm} onChange={(e) => setComm(+e.target.value || 0)} />
              </label>
              <label className="field"><span>Daily dial goal</span>
                <input type="number" value={dialGoal} onChange={(e) => setDialGoal(+e.target.value || 1)} />
              </label>
            </div>
            <button className="btn primary wide" onClick={finish} disabled={busy}>
              {busy ? 'Opening…' : 'Enter QuackedDialer'}
            </button>
          </>
        )}
        {error && <p className="err">{error}</p>}
      </div>
    </div>
  );
}
