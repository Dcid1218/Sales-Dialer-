import { useEffect, useRef, useState } from 'react';
import type { Store } from '../App.tsx';
import { api } from '../lib/api.ts';
import { BrandMark } from '../components/BrandMark.tsx';
import { Sheet } from '../components/ui.tsx';

async function fileToDataUrl(file: File, max = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read fail'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function Admin({ store }: { store: Store }) {
  const [agencies, setAgencies] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [agencyOpen, setAgencyOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<any | null>(null);
  const [editAgency, setEditAgency] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [logo, setLogo] = useState('');
  const [primary, setPrimary] = useState('#C4A35A');
  const [accent, setAccent] = useState('#0B5C3B');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [a, t] = await Promise.all([api.adminAgencies(), api.adminTeams()]);
    setAgencies(a.agencies || []);
    setTeams(t.teams || []);
  }

  useEffect(() => {
    if (store.user.role === 'admin') load().catch((e) => setErr(e.message));
  }, [store.user.role]);

  if (store.user.role !== 'admin') return <p className="empty">Admin only.</p>;

  function resetForm() {
    setName(''); setLogo(''); setPrimary('#C4A35A'); setAccent('#0B5C3B'); setAgencyId(agencies[0]?.id || '');
  }

  return (
    <>
      <div className="admin-hero card">
        <BrandMark size={56} />
        <div>
          <h2>QuackedDialer Admin</h2>
          <p className="muted">Agencies, teams, and white-label logos.</p>
        </div>
      </div>

      <div className="sec" style={{ marginTop: 18 }}>
        <h2>Agencies</h2>
        <button className="btn quiet" onClick={() => { resetForm(); setAgencyOpen(true); }}>Add agency</button>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="card list">
        {agencies.map((a) => (
          <div key={a.id} className="list-row">
            <BrandMark brand={{ logoUrl: a.logo || a.brand?.logoUrl, logoText: a.name?.slice(0, 2), appName: a.name }} size={40} />
            <div style={{ flex: 1 }}>
              <b>{a.name}</b>
              <div className="tiny muted">{a.slug} · {a.team_count} teams · {a.active ? 'active' : 'off'}</div>
            </div>
            <button className="btn quiet" onClick={() => {
              setEditAgency(a);
              setName(a.name);
              setLogo(a.logo || a.brand?.logoUrl || '');
              setPrimary(a.brand?.primary || '#C4A35A');
              setAccent(a.brand?.accent || '#0B5C3B');
            }}>Edit</button>
            <button className="btn quiet" onClick={async () => {
              await api.updateAgency(a.id, { active: !a.active });
              load();
            }}>{a.active ? 'Disable' : 'Enable'}</button>
          </div>
        ))}
        {!agencies.length && <p className="empty">No agencies yet.</p>}
      </div>

      <div className="sec">
        <h2>Teams</h2>
        <button className="btn quiet" onClick={() => { resetForm(); setTeamOpen(true); }}>Add team</button>
      </div>
      <div className="card list">
        {teams.map((t) => (
          <div key={t.id} className="list-row">
            <BrandMark brand={t.brand} size={40} />
            <div style={{ flex: 1 }}>
              <b>{t.name}</b>
              <div className="tiny muted">
                {t.agency_name || 'No agency'} · {t.member_count} members · {t.active ? 'active' : 'off'}
              </div>
            </div>
            <button className="btn quiet" onClick={() => {
              setEditTeam(t);
              setName(t.name);
              setLogo(t.brand?.logoUrl || '');
              setPrimary(t.brand?.primary || '#C4A35A');
              setAccent(t.brand?.accent || '#0B5C3B');
              setAgencyId(t.agency_id || '');
            }}>Edit</button>
            <button className="btn quiet" onClick={async () => {
              await api.updateTeam(t.id, { active: !t.active });
              load();
            }}>{t.active ? 'Disable' : 'Enable'}</button>
          </div>
        ))}
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setLogo(await fileToDataUrl(f));
      }} />

      {(agencyOpen || editAgency) && (
        <Sheet title={editAgency ? 'Edit agency' : 'New agency'} onClose={() => { setAgencyOpen(false); setEditAgency(null); }}>
          <div className="logo-edit">
            <BrandMark brand={{ logoUrl: logo, appName: name || 'Agency' }} size={72} />
            <button className="btn quiet" type="button" onClick={() => fileRef.current?.click()}>Upload logo</button>
          </div>
          <label className="field"><span>Agency name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="QuackedDialer Agency" />
          </label>
          <div className="grid2">
            <label className="field"><span>Gold</span>
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} />
            </label>
            <label className="field"><span>Green</span>
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
            </label>
          </div>
          <button className="btn primary wide" disabled={!name.trim()} onClick={async () => {
            const brand = {
              appName: name.trim(),
              tagline: 'Powered by QuackedDialer',
              primary, accent,
              logoText: name.trim().slice(0, 2).toUpperCase(),
              logoUrl: logo || '/brand/quacked-logo.jpg',
              theme: 'light',
              bg: '#F7F5F0',
            };
            if (editAgency) {
              await api.updateAgency(editAgency.id, { name: name.trim(), logo: logo || null, brand });
              store.say('Agency updated.');
            } else {
              await api.createAgency({ name: name.trim(), logo: logo || brand.logoUrl, brand });
              store.say('Agency created.');
            }
            setAgencyOpen(false); setEditAgency(null); resetForm(); load();
          }}>{editAgency ? 'Save' : 'Create agency'}</button>
        </Sheet>
      )}

      {(teamOpen || editTeam) && (
        <Sheet title={editTeam ? 'Edit team' : 'New team'} onClose={() => { setTeamOpen(false); setEditTeam(null); }}>
          <div className="logo-edit">
            <BrandMark brand={{ logoUrl: logo, logoText: name.slice(0, 2) || 'TM', appName: name || 'Team' }} size={72} />
            <button className="btn quiet" type="button" onClick={() => fileRef.current?.click()}>Upload logo</button>
          </div>
          <label className="field"><span>Team name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="WOLFPACK DIRECT" />
          </label>
          <label className="field"><span>Agency</span>
            <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
              <option value="">No agency</option>
              {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <div className="grid2">
            <label className="field"><span>Gold</span>
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} />
            </label>
            <label className="field"><span>Green</span>
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
            </label>
          </div>
          <button className="btn primary wide" disabled={!name.trim()} onClick={async () => {
            const brand = {
              appName: name.trim(),
              tagline: 'Powered by QuackedDialer',
              primary, accent,
              logoText: name.trim().slice(0, 2).toUpperCase(),
              logoUrl: logo || '',
              theme: 'light',
              bg: '#F7F5F0',
            };
            if (editTeam) {
              await api.updateTeam(editTeam.id, { name: name.trim(), agency_id: agencyId || null, brand });
              store.say('Team updated.');
            } else {
              await api.createTeam({ name: name.trim(), agency_id: agencyId || null, logo, brand });
              store.say('Team created.');
            }
            setTeamOpen(false); setEditTeam(null); resetForm(); load();
          }}>{editTeam ? 'Save' : 'Create team'}</button>
        </Sheet>
      )}
    </>
  );
}
