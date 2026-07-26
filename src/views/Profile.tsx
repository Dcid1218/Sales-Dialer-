import { useRef, useState } from 'react';
import type { Store } from '../App.tsx';
import { api } from '../lib/api.ts';
import { Avatar, Sheet } from '../components/ui.tsx';

export default function Profile({ store }: { store: Store }) {
  const { user, settings, setUser, reload, say } = store;
  const [goals, setGoals] = useState(false);
  const [integ, setInteg] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [g, setG] = useState(settings);
  const [crmUrl, setCrmUrl] = useState(settings.crmUrl || '');
  const [crmKey, setCrmKey] = useState('');
  const [dialerUrl, setDialerUrl] = useState(settings.dialerUrl || '');
  const [dialerKey, setDialerKey] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function setAvatar(file: File | null) {
    if (!file || !file.type.startsWith('image/')) return;
    const dataUrl = await compress(file);
    const { user: next } = await api.updateMe({ avatar: dataUrl });
    setUser(next);
    say('Photo updated.');
  }

  return (
    <>
      <div className="card profile-hero">
        <button type="button" className="avatar-btn" onClick={() => fileRef.current?.click()}>
          <Avatar src={user.avatar} name={user.name || user.email} size={72} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} />
        <div>
          <h2>{user.name || 'Agent'}</h2>
          <p className="muted">{user.email}</p>
          <div className="pills">
            <span className="pill">{user.team_name || 'No team'}</span>
            <span className="pill">{user.role}</span>
          </div>
        </div>
      </div>

      <div className="card list">
        <button className="list-row btnish" onClick={() => { setG(settings); setGoals(true); }}>
          <div><b>Goals & commission</b><div className="tiny muted">${settings.annual} · {settings.comm}% · {settings.dialGoal} dials</div></div>
        </button>
        <button className="list-row btnish" onClick={() => setInteg(true)}>
          <div><b>CRM & auto-dialer</b><div className="tiny muted">Webhooks for sync and session start</div></div>
        </button>
        <button className="list-row btnish" onClick={() => setImportOpen(true)}>
          <div><b>Import old local data</b><div className="tiny muted">Paste ASCEND localStorage JSON</div></div>
        </button>
        <button
          className="list-row btnish"
          onClick={async () => {
            try {
              const r = await api.crmSync();
              say(r.ok ? `Synced ${r.pushed} days to CRM` : r.error);
            } catch (e: any) { say(e.message); }
          }}
        >
          <div><b>Push CRM sync now</b><div className="tiny muted">Last 30 days to your CRM webhook</div></div>
        </button>
        <button
          className="list-row btnish"
          onClick={async () => {
            try {
              await api.dialerStart();
              say('Dialer session start sent.');
            } catch (e: any) { say(e.message); }
          }}
        >
          <div><b>Start auto-dialer session</b><div className="tiny muted">POST start payload to dialer URL</div></div>
        </button>
      </div>

      <button
        className="btn wide"
        style={{ marginTop: 18 }}
        onClick={async () => { await api.logout(); location.reload(); }}
      >
        Sign out
      </button>

      {goals && (
        <Sheet title="Goals" onClose={() => setGoals(false)}>
          <label className="field"><span>Annual income</span>
            <input type="number" value={g.annual} onChange={(e) => setG({ ...g, annual: +e.target.value || 0 })} />
          </label>
          <label className="field"><span>Commission %</span>
            <input type="number" value={g.comm} onChange={(e) => setG({ ...g, comm: +e.target.value || 0 })} />
          </label>
          <label className="field"><span>Workdays / week</span>
            <input type="number" value={g.workdays} onChange={(e) => setG({ ...g, workdays: +e.target.value || 6 })} />
          </label>
          <label className="field"><span>Daily dial goal</span>
            <input type="number" value={g.dialGoal} onChange={(e) => setG({ ...g, dialGoal: +e.target.value || 1 })} />
          </label>
          <button className="btn primary wide" onClick={async () => {
            await api.saveSettings(g);
            await reload();
            say('Saved.');
            setGoals(false);
          }}>Save</button>
        </Sheet>
      )}

      {integ && (
        <Sheet title="Integrations" onClose={() => setInteg(false)}>
          <label className="field"><span>CRM webhook URL</span>
            <input value={crmUrl} onChange={(e) => setCrmUrl(e.target.value)} placeholder="https://hooks.example.com/crm" />
          </label>
          <label className="field"><span>CRM API key (optional)</span>
            <input value={crmKey} onChange={(e) => setCrmKey(e.target.value)} placeholder={settings.hasCrmKey ? '•••• saved' : 'Bearer token'} />
          </label>
          <label className="field"><span>Auto-dialer webhook URL</span>
            <input value={dialerUrl} onChange={(e) => setDialerUrl(e.target.value)} placeholder="https://hooks.example.com/dialer" />
          </label>
          <label className="field"><span>Dialer API key (optional)</span>
            <input value={dialerKey} onChange={(e) => setDialerKey(e.target.value)} placeholder={settings.hasDialerKey ? '•••• saved' : 'Bearer token'} />
          </label>
          <button className="btn primary wide" onClick={async () => {
            await api.saveSettings({
              ...settings,
              crmUrl,
              dialerUrl,
              ...(crmKey ? { crmKey } : {}),
              ...(dialerKey ? { dialerKey } : {}),
            });
            await reload();
            say('Integrations saved.');
            setInteg(false);
          }}>Save</button>
        </Sheet>
      )}

      {importOpen && (
        <Sheet title="Import localStorage" onClose={() => setImportOpen(false)}>
          <p className="muted tiny" style={{ marginBottom: 12 }}>
            Paste JSON shaped like <code>{`{"days":{...},"settings":{...}}`}</code> or the raw days map from the old ASCEND app.
          </p>
          <button
            className="btn quiet"
            style={{ marginBottom: 10 }}
            onClick={() => {
              try {
                const days = localStorage.getItem('ascend_days');
                const settingsRaw = localStorage.getItem('ascend_settings');
                if (!days) return say('No ascend_days found in this browser.');
                setImportText(JSON.stringify({
                  days: JSON.parse(days),
                  settings: settingsRaw ? JSON.parse(settingsRaw) : undefined,
                }, null, 2));
              } catch { say('Could not read localStorage.'); }
            }}
          >
            Auto-fill from this browser
          </button>
          <label className="field"><span>JSON</span>
            <textarea rows={10} value={importText} onChange={(e) => setImportText(e.target.value)} />
          </label>
          <button className="btn primary wide" onClick={async () => {
            try {
              const parsed = JSON.parse(importText);
              const r = await api.importDays(parsed);
              await reload();
              say(`Imported ${r.imported} days.`);
              setImportOpen(false);
            } catch (e: any) {
              say(e.message || 'Import failed.');
            }
          }}>Import</button>
        </Sheet>
      )}
    </>
  );
}

function compress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read fail'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 512;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
