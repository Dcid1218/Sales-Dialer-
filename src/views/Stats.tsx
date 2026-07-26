import { useMemo, useState } from 'react';
import type { Store } from '../App.tsx';
import {
  addDays, bestStreak, blankDay, currentStreak, dayKey, money$, periodAgg,
} from '../lib/core.ts';
import { Segmented } from '../components/ui.tsx';

export default function Stats({ store }: { store: Store }) {
  const { days, settings } = store;
  const [period, setPeriod] = useState(7);
  const [metric, setMetric] = useState<'premium' | 'dials' | 'income'>('premium');
  const a = useMemo(() => periodAgg(days, settings, period), [days, settings, period]);
  const cur = useMemo(() => currentStreak(days, settings), [days, settings]);
  const best = useMemo(() => bestStreak(days, settings), [days, settings]);

  const chart = useMemo(() => {
    const t0 = new Date();
    const vals: number[] = [];
    const labs: number[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const dt = addDays(t0, -i);
      const r = days[dayKey(dt)] || blankDay();
      const v = metric === 'dials' ? r.dials : metric === 'income' ? r.premium * ((settings.comm || 0) / 100) : r.premium;
      vals.push(v);
      labs.push(dt.getDate());
    }
    const max = Math.max(1, ...vals);
    return { vals, labs, max };
  }, [days, settings, period, metric]);

  return (
    <>
      <div className="sec" style={{ marginTop: 6 }}>
        <h3>Totals</h3>
        <div className="ln" />
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: 7, label: '7d' },
            { value: 30, label: '30d' },
            { value: 90, label: '90d' },
          ]}
        />
      </div>
      <div className="stat-grid">
        <div><span className="eyebrow">Dials</span><b className="mono">{a.dials}</b></div>
        <div><span className="eyebrow">Contacts</span><b className="mono">{a.contacts}</b></div>
        <div><span className="eyebrow">Appts</span><b className="mono">{a.appts}</b></div>
        <div><span className="eyebrow">Sales</span><b className="mono">{a.sales}</b></div>
        <div><span className="eyebrow">Premium</span><b className="mono">{money$(a.premium)}</b></div>
        <div><span className="eyebrow">Income</span><b className="mono">{money$(a.income)}</b></div>
      </div>

      <div className="sec">
        <h3>Chart</h3>
        <div className="ln" />
        <Segmented
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'premium', label: 'Premium' },
            { value: 'income', label: 'Income' },
            { value: 'dials', label: 'Dials' },
          ]}
        />
      </div>
      <div className="card chart">
        {chart.vals.map((v, i) => (
          <div key={i} className="colwrap">
            <div
              className={`col ${metric === 'dials' ? '' : 'em'} ${i === chart.vals.length - 1 ? 'today' : ''}`}
              style={{ height: `${(v / chart.max) * 100}%` }}
              title={metric === 'dials' ? String(v) : money$(v)}
            />
            {period <= 14 && <div className="collab">{chart.labs[i]}</div>}
          </div>
        ))}
      </div>

      <div className="sec"><h3>Streaks</h3><div className="ln" /></div>
      <div className="stat-grid">
        <div><span className="eyebrow">Current</span><b className="mono">{cur}</b></div>
        <div><span className="eyebrow">Best</span><b className="mono">{best}</b></div>
        <div><span className="eyebrow">Close rate</span><b className="mono">{a.appts ? Math.round(a.sales / a.appts * 100) : 0}%</b></div>
      </div>
    </>
  );
}
