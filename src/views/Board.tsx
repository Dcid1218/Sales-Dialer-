import { useEffect, useState } from 'react';
import type { Store } from '../App.tsx';
import { api } from '../lib/api.ts';
import { money$ } from '../lib/core.ts';
import { Avatar, Segmented } from '../components/ui.tsx';

export default function Board({ store }: { store: Store }) {
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.leaderboard(days)
      .then((r: any) => setRows(r.rows || []))
      .catch((e) => setErr(e.message));
  }, [days, store.user.team_id]);

  return (
    <>
      <div className="sec" style={{ marginTop: 6 }}>
        <h2>Leaderboard</h2>
        <Segmented
          value={days}
          onChange={setDays}
          options={[
            { value: 7, label: '7d' },
            { value: 30, label: '30d' },
            { value: 90, label: '90d' },
          ]}
        />
      </div>
      <p className="muted tiny">Team premium and dials. Managers see the full squad.</p>
      {err && <p className="err">{err}</p>}
      <div className="board-list">
        {rows.length === 0 && <p className="empty">No team activity yet. Log dials to climb.</p>}
        {rows.map((r, i) => (
          <div key={r.id} className={`board-row ${r.id === store.user.id ? 'me' : ''}`}>
            <span className="rank mono">{i + 1}</span>
            <Avatar src={r.avatar} name={r.name} size={36} />
            <div className="board-body">
              <b>{r.name || 'Agent'}</b>
              <span>{r.team_name} · {r.role}</span>
            </div>
            <div className="board-metrics">
              <b className="mono">{money$(Number(r.premium))}</b>
              <span className="mono">{r.dials} dials · {r.sales} sales</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
