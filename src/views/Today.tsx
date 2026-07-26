import { useMemo, useState } from 'react';
import type { Store } from '../App.tsx';
import {
  blankDay, dailyIncomeTarget, dailyPremiumTarget, dayKey, money, money$, pctNum, currentStreak,
} from '../lib/core.ts';
import { Sheet } from '../components/ui.tsx';

export default function Today({ store }: { store: Store }) {
  const { days, settings, bump, savePremium } = store;
  const today = days[dayKey()] || blankDay();
  const income = today.premium * ((settings.comm || 0) / 100);
  const tgt = dailyIncomeTarget(settings);
  const ptgt = dailyPremiumTarget(settings);
  const pct = tgt > 0 ? income / tgt : 0;
  const C = 2 * Math.PI * 52;
  const streak = useMemo(() => currentStreak(days, settings), [days, settings]);
  const [premOpen, setPremOpen] = useState(false);
  const [prem, setPrem] = useState('');
  const [alsoSale, setAlsoSale] = useState(true);

  const pace = useMemo(() => {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    if (now.getDay() === 0) return { cls: 'flat', text: 'REST DAY' };
    const start = 9 * 60, end = 21 * 60;
    if (mins < start) return { cls: 'flat', text: 'DAY NOT STARTED' };
    if (mins >= end) {
      const diff = income - tgt;
      return { cls: diff >= 0 ? 'ahead' : 'behind', text: (diff >= 0 ? 'GOAL HIT · +' : 'DAY DONE · ') + money$(Math.abs(diff)) + (diff >= 0 ? '' : ' short') };
    }
    const expected = tgt * ((mins - start) / (end - start));
    const diff = income - expected;
    if (Math.abs(diff) < 1) return { cls: 'flat', text: 'ON PACE' };
    return { cls: diff >= 0 ? 'ahead' : 'behind', text: (diff >= 0 ? 'AHEAD +' : 'BEHIND ') + money$(Math.abs(diff)) };
  }, [income, tgt]);

  return (
    <>
      <div className="card hero">
        <div className="ringwrap">
          <svg className="ring" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--gold)" />
                <stop offset="100%" stopColor="var(--gold2)" />
              </linearGradient>
            </defs>
            <circle className="ring-track" cx="60" cy="60" r="52" />
            <circle
              className="ring-prog"
              cx="60" cy="60" r="52"
              style={{ strokeDasharray: C, strokeDashoffset: C * (1 - Math.min(1, pct)) }}
            />
          </svg>
          <div className="ring-ctr">
            <div className="lab">Income</div>
            <div className="big mono">{money(income)}<span className="c">$</span></div>
            <div className="pct">{Math.round(pct * 100)}%</div>
          </div>
        </div>
        <div className="hero-side">
          <div className="row"><span className="k">Daily target</span><span className="v mono">{money$(tgt)}</span></div>
          <div className="row"><span className="k">Premium today</span><span className="v mono">{money$(today.premium)}</span></div>
          <div className="row"><span className="k">To goal</span><span className="v mono">{money$(Math.max(0, tgt - income))}</span></div>
          <div className={`pace ${pace.cls}`}>{pace.text}</div>
          <div className="streak-inline">🔥 {streak} day streak</div>
        </div>
      </div>

      <div className="sec"><h3>Counters</h3><div className="ln" /></div>
      <div className="ctrs">
        {([
          ['dials', 'Dials', 'dials'],
          ['contacts', 'Contacts', 'contacts'],
          ['appts', 'Appts set', 'appts'],
          ['sales', 'Sales', 'sales'],
        ] as const).map(([k, lab, cls]) => (
          <button key={k} type="button" className={`ctr ${cls}`} onClick={() => bump(k, 1)}>
            <span className="accent" />
            <button type="button" className="dec" onClick={(e) => { e.stopPropagation(); bump(k, -1); }}>−</button>
            <div className="num mono">{today[k]}</div>
            <div className="lab">{lab} <span className="tap">tap</span></div>
          </button>
        ))}
        <div className="ctr premium">
          <div className="top">
            <div>
              <div className="num mono">{money$(today.premium)}</div>
              <div className="lab">Premium written</div>
            </div>
            <button type="button" className="addbtn" onClick={() => { setPrem(''); setPremOpen(true); }}>+ Add</button>
          </div>
        </div>
      </div>

      <div className="sec"><h3>Ratios</h3><div className="ln" /></div>
      <div className="ratios">
        <div className="rt"><div className="v mono">{pctNum(today.contacts, today.dials)}%</div><div className="k">Contact</div></div>
        <div className="rt"><div className="v mono">{pctNum(today.appts, today.contacts)}%</div><div className="k">Set</div></div>
        <div className="rt"><div className="v mono">{pctNum(today.sales, today.appts)}%</div><div className="k">Close</div></div>
        <div className="rt"><div className="v mono">${today.dials > 0 ? (today.premium / today.dials).toFixed(0) : '0'}</div><div className="k">$/dial</div></div>
      </div>

      <div className="sec"><h3>Goals</h3><div className="ln" /></div>
      <div className="goalbar">
        <div className="top"><span className="t">Dials</span><span className="n mono">{today.dials} / {settings.dialGoal}</span></div>
        <div className="track"><div className="fill" style={{ width: `${Math.min(100, pctNum(today.dials, settings.dialGoal))}%` }} /></div>
      </div>
      <div className="goalbar" style={{ marginTop: 10 }}>
        <div className="top"><span className="t">Premium</span><span className="n mono">{money$(today.premium)} / {money$(ptgt)}</span></div>
        <div className="track"><div className="fill em" style={{ width: `${Math.min(100, ptgt > 0 ? Math.round(today.premium / ptgt * 100) : 0)}%` }} /></div>
      </div>

      <button className="btn primary wide" style={{ marginTop: 16 }} onClick={() => setPremOpen(true)}>
        + Quick premium
      </button>
      <p className="tiny muted" style={{ marginTop: 8, textAlign: 'center' }}>
        For full deals (carrier + draft date), use the Deals tab.
      </p>

      {premOpen && (
        <Sheet title="Add premium" onClose={() => setPremOpen(false)}>
          <label className="field"><span>Amount</span>
            <input type="number" inputMode="decimal" value={prem} onChange={(e) => setPrem(e.target.value)} autoFocus />
          </label>
          <div className="quick">
            {[500, 1000, 1500, 2500].map((a) => (
              <button key={a} type="button" onClick={() => setPrem(String((+prem || 0) + a))}>+{a}</button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={alsoSale} onChange={(e) => setAlsoSale(e.target.checked)} />
            Also count as a sale
          </label>
          <button
            className="btn primary wide"
            onClick={async () => {
              const amt = parseFloat(prem || '0');
              if (amt) await savePremium(amt, alsoSale);
              setPremOpen(false);
            }}
          >
            Save
          </button>
        </Sheet>
      )}
    </>
  );
}
