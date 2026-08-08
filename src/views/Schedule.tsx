import { useCallback, useEffect, useState } from 'react';
import {
  STANDARD, ISLAND, ZONES, partsIn, fmt12,
} from '../lib/core.ts';
import { Segmented } from '../components/ui.tsx';
import { api } from '../lib/api.ts';
import type { Store } from '../App.tsx';

type Block = [number, number, string, string, string];

const HOME_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
const WDIDX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const TYPES = ['call', 'off', 'move', 'meal', 'hawaii'] as const;

function minsToInput(m: number) {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function inputToMins(s: string) {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export default function Schedule({ store }: { store: Store }) {
  const isMgr = store.user.role === 'manager' || store.user.role === 'admin';
  const [now, setNow] = useState(new Date());
  const [mode, setMode] = useState<'std' | 'isl' | 'custom'>('std');
  const [blocks, setBlocks] = useState<Block[]>(STANDARD as Block[]);
  const [source, setSource] = useState('default');
  const [hasUserOverride, setHasUserOverride] = useState(false);
  const [teamName, setTeamName] = useState('Team plan');
  const [editing, setEditing] = useState(false);
  const [editTarget, setEditTarget] = useState<'user' | 'team'>('user');
  const [draft, setDraft] = useState<Block[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await api.schedule();
      const m = (data.mode as 'std' | 'isl' | 'custom') || 'std';
      setMode(m);
      setSource(data.source || 'default');
      setHasUserOverride(!!data.hasUserOverride);
      if (data.team?.name) setTeamName(data.team.name);
      if (m === 'custom' && data.blocks?.length) {
        setBlocks(data.blocks as Block[]);
      } else if (m === 'isl') {
        setBlocks(ISLAND as Block[]);
      } else if (data.blocks?.length) {
        setBlocks(data.blocks as Block[]);
      } else {
        setBlocks(STANDARD as Block[]);
      }
    } catch { /* defaults */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyPreset = (m: 'std' | 'isl') => {
    setMode(m);
    setBlocks(m === 'std' ? (STANDARD as Block[]) : (ISLAND as Block[]));
  };

  const startEdit = (target: 'user' | 'team') => {
    setEditTarget(target);
    setDraft(blocks.map((b) => [...b] as Block));
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const sorted = [...draft].sort((a, b) => a[0] - b[0]);
      if (editTarget === 'team') {
        await api.saveTeamSchedule({ mode: 'custom', blocks: sorted, name: teamName });
        store.say('Team plan saved');
      } else {
        await api.saveSchedule({ mode: 'custom', blocks: sorted });
        store.say('Your plan saved');
      }
      setMode('custom');
      setBlocks(sorted);
      setEditing(false);
      await load();
    } catch (e: any) {
      store.say(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const useTeamPlan = async () => {
    try {
      await api.clearSchedule();
      store.say('Using team plan');
      await load();
    } catch (e: any) {
      store.say(e.message || 'Failed');
    }
  };

  const home = partsIn(HOME_TZ, now);
  const cf = fmt12(home.h, home.m);
  const mins = home.h * 60 + home.m;
  const work = (WDIDX[home.wd] ?? 0) >= 1 && (WDIDX[home.wd] ?? 0) <= 6;
  const schedule = blocks;
  const ai = work ? schedule.findIndex((b) => mins >= b[0] && mins < b[1]) : -1;
  const block = ai >= 0 ? schedule[ai] : null;
  const onCall = !!(block && (block[3] === 'call' || block[3] === 'hawaii'));

  let tzName = '';
  try {
    tzName = new Intl.DateTimeFormat('en-US', { timeZone: HOME_TZ, timeZoneName: 'short' })
      .formatToParts(now).find((p) => p.type === 'timeZoneName')?.value || '';
  } catch { /* ignore */ }
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][WDIDX[home.wd] ?? 0];

  return (
    <>
      <div className="card clockcard">
        <div>
          <div className="clock mono">{cf.t}:{String(home.s).padStart(2, '0')}<span className="mer">{cf.mer}</span></div>
          <div className="clocksub">{dayName} · {tzName}</div>
        </div>
        <div className={`onpill ${onCall ? 'live' : ''}`}>
          <span className="dot" />
          {onCall ? 'ON THE PHONES' : work ? 'OFF / PERSONAL' : 'REST DAY'}
        </div>
      </div>

      <div className={`card directive ${onCall ? 'call' : ''}`}>
        <div className="d-mark">{block?.[3] === 'hawaii' ? '🌙' : block?.[3] === 'call' ? '☎' : block?.[3] === 'meal' ? '🍽' : '•'}</div>
        <div className="d-body">
          <div className="lab">Right now · source: {source}</div>
          <h2>{!work ? 'Rest Day' : block ? block[2] : 'Off the clock'}</h2>
          {block && (
            <div className="rng">
              {fmt12(Math.floor(block[0] / 60), block[0] % 60).t} – {fmt12(Math.floor(block[1] / 60) % 24, block[1] % 60).t}
            </div>
          )}
          <div className="act">{!work ? 'No dialing today. Recover and reload the pipeline.' : block?.[4] || ''}</div>
        </div>
      </div>

      <div className="sec"><h3>Zones</h3><div className="ln" /></div>
      <div className="zones">
        {ZONES.map((z) => {
          const p = partsIn(z.tz, now);
          const st = (p.h < 8 || p.h >= 21) ? 'closed' : (p.h >= 17 ? 'prime' : 'open');
          const f = fmt12(p.h, p.m);
          const homeDec = home.h + home.m / 60;
          let off = Math.round((p.h + p.m / 60) - homeDec);
          if (off > 12) off -= 24; if (off < -12) off += 24;
          const offTxt = z.tz === HOME_TZ ? 'YOU' : off === 0 ? 'SAME' : (off > 0 ? `+${off}h` : `${off}h`);
          return (
            <div key={z.abbr} className={`zone ${st}`}>
              <div className="bar" />
              <div className="z-top"><span className="z-name">{z.name}</span><span className="z-abbr">{z.abbr}</span></div>
              <div className="z-time mono">{f.t}<span className="m">{f.mer}</span></div>
              <div className="z-foot">
                <span className={`badge ${st}`}>{st.toUpperCase()}</span>
                <span className="z-off">{offTxt}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sec">
        <h3>Day plan</h3>
        <div className="ln" />
        {!editing && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Segmented
              value={mode === 'custom' ? 'std' : mode}
              onChange={(v) => applyPreset(v as 'std' | 'isl')}
              options={[
                { value: 'std', label: 'Standard' },
                { value: 'isl', label: 'Island' },
              ]}
            />
            <button type="button" className="btn" onClick={() => startEdit('user')}>Edit my plan</button>
            {isMgr && store.user.team_id && (
              <button type="button" className="btn" onClick={() => startEdit('team')}>Edit team plan</button>
            )}
            {hasUserOverride && (
              <button type="button" className="btn quiet" onClick={useTeamPlan}>Use team plan</button>
            )}
            {mode === 'custom' && <span className="pill">Custom</span>}
            {source === 'team' && <span className="pill">Team</span>}
          </div>
        )}
        {editing && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="pill">{editTarget === 'team' ? `Editing: ${teamName}` : 'Editing: My plan'}</span>
            {editTarget === 'team' && (
              <input
                style={{ maxWidth: 180, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line2)' }}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team plan name"
              />
            )}
            <button type="button" className="btn primary" disabled={saving} onClick={saveEdit}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
            <button
              type="button"
              className="btn"
              onClick={() => setDraft((d) => [...d, [540, 600, 'New block', 'off', ''] as Block])}
            >
              + Block
            </button>
          </div>
        )}
      </div>

      {!editing && (
        <div className="timeline">
          {schedule.map((b, i) => {
            const a = fmt12(Math.floor(b[0] / 60), b[0] % 60);
            const e = fmt12(Math.floor(b[1] / 60) % 24, b[1] % 60);
            const cls = [b[3]];
            if (i === ai) cls.push('active');
            else if (work && b[1] <= mins) cls.push('past');
            return (
              <div key={i} className={`blk ${cls.join(' ')}`}>
                <span className="t">{a.t}{a.mer[0]} – {e.t}{e.mer[0]}</span>
                <div style={{ flex: 1 }}>
                  <div className="ttl">{b[2]}</div>
                  {b[4] && <div className="ac">{b[4]}</div>}
                </div>
                <span className={`tg ${b[3]}`}>{b[3].toUpperCase()}</span>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="timeline edit-schedule">
          {draft.map((b, i) => (
            <div key={i} className="blk edit-blk">
              <div className="edit-row">
                <label>
                  Start
                  <input type="time" value={minsToInput(b[0])} onChange={(e) => {
                    const next = [...draft]; next[i] = [...next[i]] as Block; next[i][0] = inputToMins(e.target.value); setDraft(next);
                  }} />
                </label>
                <label>
                  End
                  <input type="time" value={minsToInput(b[1])} onChange={(e) => {
                    const next = [...draft]; next[i] = [...next[i]] as Block; next[i][1] = inputToMins(e.target.value); setDraft(next);
                  }} />
                </label>
                <label>
                  Type
                  <select value={b[3]} onChange={(e) => {
                    const next = [...draft]; next[i] = [...next[i]] as Block; next[i][3] = e.target.value; setDraft(next);
                  }}>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>
              <label className="wide">
                Title
                <input value={b[2]} onChange={(e) => {
                  const next = [...draft]; next[i] = [...next[i]] as Block; next[i][2] = e.target.value; setDraft(next);
                }} />
              </label>
              <label className="wide">
                Note
                <input value={b[4] || ''} onChange={(e) => {
                  const next = [...draft]; next[i] = [...next[i]] as Block; next[i][4] = e.target.value; setDraft(next);
                }} />
              </label>
              <button type="button" className="btn quiet" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
