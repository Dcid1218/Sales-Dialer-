import { useEffect, useState } from 'react';
import type { Store } from '../App.tsx';
import { api } from '../lib/api.ts';
import { Sheet } from '../components/ui.tsx';

export default function Admin({ store }: { store: Store }) {
  const [teams, setTeams] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState('#f5c451');
  const [accent, setAccent] = useState('#10d488');
  const [err, setErr] = useState('');

  async function load() {
    const r = await api.adminTeams();
    setTeams(r.teams || []);
  }

  useEffect(() => {
    if (store.user.role === 'admin') load().catch((e) => setErr(e.message));
  }, [store.user.role]);

  if (store.user.role !== 'admin') return <p className="empty">Admin only.</p>;

  return (
    <>
      <div className="sec" style={{ marginTop: 6 }}>
        <h2>Teams</h2>
        <button className="btn quiet" onClick={() => setOpen(true)}>New team</button>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="card list">
        {teams.map((t) => (
          <div key={t.id} className="list-row">
            <div style={{ flex: 1 }}>
              <b>{t.name}</b>
              <div className="tiny muted">{t.slug} · {t.member_count} members · {t.active ? 'active' : 'off'}</div>
            </div>
            <button
              className="btn quiet"
              onClick={async () => {
                await api.updateTeam(t.id, { active: !t.active });
                load();
              }}
            >
              {t.active ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>

      {open && (
        <Sheet title="Create team" onClose={() => setOpen(false)}>
          <label className="field"><span>Team name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="WOLFPACK DIRECT" />
          </label>
          <div className="grid2">
            <label className="field"><span>Primary</span>
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} />
            </label>
            <label className="field"><span>Accent</span>
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
            </label>
          </div>
          <button
            className="btn primary wide"
            disabled={!name.trim()}
            onClick={async () => {
              await api.createTeam({
                name: name.trim(),
                brand: {
                  appName: name.trim(),
                  tagline: 'Powered by Zippy CRM',
                  primary, accent,
                  logoText: name.trim().slice(0, 2).toUpperCase(),
                  theme: 'dark',
                  bg: '#05070a',
                },
              });
              store.say('Team created.');
              setOpen(false);
              setName('');
              load();
            }}
          >
            Create
          </button>
        </Sheet>
      )}
    </>
  );
}
