import { useEffect, useState } from 'react';
import type { Store } from '../App.tsx';
import { api } from '../lib/api.ts';
import { Avatar } from '../components/ui.tsx';

export default function Manage({ store }: { store: Store }) {
  const [members, setMembers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [err, setErr] = useState('');

  async function load() {
    try {
      const m = await api.teamMembers();
      setMembers(m.members || []);
      const l = await api.integrationsLog().catch(() => ({ rows: [] }));
      setLogs(l.rows || []);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  if (store.user.role !== 'manager' && store.user.role !== 'admin') {
    return <p className="empty">Manager access required.</p>;
  }

  return (
    <>
      <div className="sec" style={{ marginTop: 6 }}><h2>Team roster</h2><div className="ln" /></div>
      {err && <p className="err">{err}</p>}
      <div className="card list">
        {members.map((m) => (
          <div key={m.id} className="list-row">
            <Avatar src={m.avatar} name={m.name} size={34} />
            <div style={{ flex: 1 }}>
              <b>{m.name || m.email}</b>
              <div className="tiny muted">{m.email}</div>
            </div>
            <select
              value={m.role}
              onChange={async (e) => {
                await api.setMemberRole(m.id, e.target.value);
                store.say('Role updated.');
                load();
              }}
            >
              <option value="agent">agent</option>
              <option value="manager">manager</option>
              {store.user.role === 'admin' && <option value="admin">admin</option>}
            </select>
          </div>
        ))}
        {!members.length && <p className="empty">No members on this team yet.</p>}
      </div>

      <div className="sec"><h2>Integration log</h2><div className="ln" /></div>
      <div className="card list">
        {logs.slice(0, 20).map((l) => (
          <div key={l.id} className="list-row">
            <div style={{ flex: 1 }}>
              <b>{l.kind}</b>
              <div className="tiny muted">{new Date(l.created_at).toLocaleString()} · {l.status}</div>
            </div>
          </div>
        ))}
        {!logs.length && <p className="empty">No CRM/dialer events yet.</p>}
      </div>
    </>
  );
}
