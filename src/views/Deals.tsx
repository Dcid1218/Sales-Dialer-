import { useEffect, useMemo, useState } from 'react';
import type { Store } from '../App.tsx';
import { api } from '../lib/api.ts';
import { money$ } from '../lib/core.ts';
import { Sheet } from '../components/ui.tsx';
import { Segmented } from '../components/ui.tsx';

type Deal = {
  id: string;
  annual_premium: number;
  carrier: string;
  draft_date: string;
  note?: string;
  agent_name?: string;
  team_name?: string;
  created_at?: string;
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Deals({ store }: { store: Store }) {
  const canTeam = store.user.role === 'manager' || store.user.role === 'admin';
  const canAll = store.user.role === 'admin';
  const [scope, setScope] = useState<'mine' | 'team' | 'all'>('mine');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [totals, setTotals] = useState({ count: 0, premium: 0 });
  const [open, setOpen] = useState(false);
  const [premium, setPremium] = useState('');
  const [carrier, setCarrier] = useState('');
  const [draftDate, setDraftDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load(s = scope) {
    const r = await api.deals(s);
    setDeals(r.deals || []);
    setTotals(r.totals || { count: 0, premium: 0 });
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [scope]);

  const monthPremium = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return deals
      .filter((d) => String(d.draft_date).startsWith(ym))
      .reduce((s, d) => s + Number(d.annual_premium || 0), 0);
  }, [deals]);

  async function submit() {
    if (busy) return;
    setBusy(true); setErr('');
    try {
      const annual_premium = Number(premium);
      if (!(annual_premium >= 0) || Number.isNaN(annual_premium)) throw new Error('Enter annual premium.');
      if (!carrier.trim()) throw new Error('Carrier is required.');
      if (!draftDate) throw new Error('Draft date is required.');
      await api.createDeal({
        annual_premium,
        carrier: carrier.trim(),
        draft_date: draftDate,
        note: note.trim(),
      });
      setOpen(false);
      setPremium(''); setCarrier(''); setNote(''); setDraftDate(todayISO());
      store.say('Deal posted.');
      await load();
      await store.reload().catch(() => {});
    } catch (e: any) {
      setErr(e.message || 'Could not post deal.');
    } finally {
      setBusy(false);
    }
  }

  const scopeOptions: { value: 'mine' | 'team' | 'all'; label: string }[] = [
    { value: 'mine', label: 'Mine' },
  ];
  if (canTeam) scopeOptions.push({ value: 'team', label: 'Team' });
  if (canAll) scopeOptions.push({ value: 'all', label: 'All' });

  return (
    <>
      <div className="sec" style={{ marginTop: 8 }}>
        <h2>Deals</h2>
        <button className="btn primary" onClick={() => setOpen(true)}>+ Post deal</button>
      </div>

      <div className="stat-grid">
        <div>
          <span className="eyebrow">Deals shown</span>
          <b className="mono">{totals.count}</b>
        </div>
        <div>
          <span className="eyebrow">AP total</span>
          <b className="mono">{money$(totals.premium)}</b>
        </div>
        <div>
          <span className="eyebrow">This month</span>
          <b className="mono">{money$(monthPremium)}</b>
        </div>
      </div>

      {scopeOptions.length > 1 && (
        <div className="sec">
          <h3>Scope</h3>
          <div className="ln" />
          <Segmented value={scope} onChange={setScope} options={scopeOptions} />
        </div>
      )}

      {err && <p className="err">{err}</p>}

      <div className="card list" style={{ marginTop: 12 }}>
        {deals.length === 0 && <p className="empty">No deals yet. Post your first one.</p>}
        {deals.map((d) => (
          <div key={d.id} className="list-row deal-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <b className="mono">{money$(Number(d.annual_premium))}</b>
              <div className="tiny muted">
                {d.carrier} · draft {d.draft_date}
                {d.agent_name ? ` · ${d.agent_name}` : ''}
                {d.team_name ? ` · ${d.team_name}` : ''}
              </div>
              {d.note ? <div className="tiny" style={{ marginTop: 4 }}>{d.note}</div> : null}
            </div>
            {(d as any).user_id === store.user.id || store.user.role !== 'agent' ? (
              <button
                className="btn quiet"
                onClick={async () => {
                  if (!confirm('Delete this deal?')) return;
                  await api.deleteDeal(d.id);
                  store.say('Deal removed.');
                  load();
                }}
              >
                Delete
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {open && (
        <Sheet title="Post a deal" onClose={() => setOpen(false)}>
          <label className="field">
            <span>Annual premium</span>
            <input
              type="number"
              inputMode="decimal"
              value={premium}
              onChange={(e) => setPremium(e.target.value)}
              placeholder="1500"
              autoFocus
            />
          </label>
          <label className="field">
            <span>Carrier</span>
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="e.g. Mutual of Omaha"
              list="carrier-suggestions"
            />
            <datalist id="carrier-suggestions">
              {[
                'Mutual of Omaha', 'AIG', 'Americo', 'Corebridge', 'Ethos', 'F&G',
                'Foresters', 'Gerber', 'John Hancock', 'Lincoln', 'Nationwide',
                'North American', 'Pacific Life', 'Protective', 'Prudential',
                'Royal Arcanum', 'Transamerica', 'Other',
              ].map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
          <label className="field">
            <span>Draft date</span>
            <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Note (optional)</span>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Product, face amount, anything useful" />
          </label>
          {err && <p className="err">{err}</p>}
          <button className="btn primary wide" disabled={busy} onClick={submit}>
            {busy ? 'Posting…' : 'Post deal'}
          </button>
        </Sheet>
      )}
    </>
  );
}
