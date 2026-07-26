import { useEffect, useState } from 'react';
import {
  STANDARD, ISLAND, ZONES, partsIn, fmt12, statusFor,
} from '../lib/core.ts';
import { Segmented } from '../components/ui.tsx';

const HOME_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
const WDIDX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export default function Schedule() {
  const [now, setNow] = useState(new Date());
  const [mode, setMode] = useState<'std' | 'isl'>('std');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const home = partsIn(HOME_TZ, now);
  const cf = fmt12(home.h, home.m);
  const mins = home.h * 60 + home.m;
  const work = (WDIDX[home.wd] ?? 0) >= 1 && (WDIDX[home.wd] ?? 0) <= 6;
  const schedule = mode === 'std' ? STANDARD : ISLAND;
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

      <div className={`card directive ${onCall ? 'call' : ''} ${mode === 'isl' ? 'isl' : ''}`}>
        <div className="d-mark">{block?.[3] === 'hawaii' ? '🌙' : block?.[3] === 'call' ? '☎' : block?.[3] === 'meal' ? '🍽' : '•'}</div>
        <div className="d-body">
          <div className="lab">Right now</div>
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
          const st = statusFor(p.h);
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
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'std', label: 'Standard' },
            { value: 'isl', label: 'Island' },
          ]}
        />
      </div>
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
    </>
  );
}
