export type DayLog = { dials: number; contacts: number; appts: number; sales: number; premium: number };
export type Settings = {
  annual: number; comm: number; workdays: number; dialGoal: number;
  crmUrl: string; crmKey: string; dialerUrl: string; dialerKey: string;
  hasCrmKey?: boolean; hasDialerKey?: boolean;
};
export type Role = 'agent' | 'manager' | 'admin';
export type User = {
  id: string; email: string; name: string; avatar: string | null; role: Role;
  team_id: string | null; onboarded: boolean;
  team_slug: string | null; team_name: string | null; team_brand: Brand | null;
};
export type Brand = {
  appName?: string; tagline?: string; primary?: string; accent?: string;
  logoText?: string; theme?: string; bg?: string;
};
export type Team = { id: string; slug: string; name: string; brand: Brand };

export const blankDay = (): DayLog => ({ dials: 0, contacts: 0, appts: 0, sales: 0, premium: 0 });

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(dt: Date, n: number) {
  const d = new Date(dt); d.setDate(d.getDate() + n); return d;
}
export function money(n: number) {
  n = Math.round(n);
  return n >= 10000
    ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0).replace(/\.0$/, '')}k`
    : n.toLocaleString('en-US');
}
export const money$ = (n: number) => `$${money(n)}`;
export const pctNum = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export function dailyIncomeTarget(s: Settings) {
  return s.annual / ((s.workdays || 6) * 52);
}
export function dailyPremiumTarget(s: Settings) {
  const c = (s.comm || 1) / 100;
  return c > 0 ? dailyIncomeTarget(s) / c : 0;
}

export function applyBrand(brand?: Brand | null) {
  const root = document.documentElement;
  const b = brand || {};
  root.style.setProperty('--gold', b.primary || '#f5c451');
  root.style.setProperty('--gold2', b.primary ? lighten(b.primary, 0.25) : '#ffe39b');
  root.style.setProperty('--em', b.accent || '#10d488');
  root.style.setProperty('--em2', b.accent ? lighten(b.accent, 0.2) : '#5cf0b8');
  root.style.setProperty('--bg', b.bg || '#05070a');
  document.title = b.appName || 'ASCEND';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', b.bg || '#05070a');
}

function lighten(hex: string, amt: number) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.min(255, Math.round(r + (255 - r) * amt));
  g = Math.min(255, Math.round(g + (255 - g) * amt));
  b = Math.min(255, Math.round(b + (255 - b) * amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function dayStatus(days: Record<string, DayLog>, settings: Settings, dt: Date, isToday: boolean) {
  const rec = days[dayKey(dt)];
  if (rec) return rec.dials >= (settings.dialGoal || 1) ? 'hit' : 'miss';
  if (isToday) return 'pending';
  if (dt.getDay() === 0) return 'rest';
  return 'miss';
}

export function currentStreak(days: Record<string, DayLog>, settings: Settings) {
  let cur = 0;
  let dt = new Date();
  if (dayStatus(days, settings, dt, true) === 'pending') dt = addDays(dt, -1);
  for (let i = 0; i < 400; i++) {
    const isT = dayKey(dt) === dayKey();
    const s = dayStatus(days, settings, dt, isT);
    if (s === 'hit') { cur++; dt = addDays(dt, -1); }
    else if (s === 'rest') dt = addDays(dt, -1);
    else break;
  }
  return cur;
}

export function bestStreak(days: Record<string, DayLog>, settings: Settings) {
  let best = 0, run = 0;
  const t = new Date();
  for (let i = 200; i >= 0; i--) {
    const dt = addDays(t, -i);
    const s = dayStatus(days, settings, dt, i === 0);
    if (s === 'hit') { run++; best = Math.max(best, run); }
    else if (s === 'rest' || s === 'pending') {}
    else run = 0;
  }
  return best;
}

export function periodAgg(days: Record<string, DayLog>, settings: Settings, n: number) {
  const t = { dials: 0, contacts: 0, appts: 0, sales: 0, premium: 0, income: 0 };
  const today0 = new Date();
  for (let i = 0; i < n; i++) {
    const r = days[dayKey(addDays(today0, -i))];
    if (r) {
      t.dials += r.dials || 0; t.contacts += r.contacts || 0;
      t.appts += r.appts || 0; t.sales += r.sales || 0; t.premium += r.premium || 0;
    }
  }
  t.income = t.premium * ((settings.comm || 0) / 100);
  return t;
}

/* schedule */
export const ZONES = [
  { name: 'Eastern', abbr: 'ET', tz: 'America/New_York' },
  { name: 'Central', abbr: 'CT', tz: 'America/Chicago' },
  { name: 'Mountain', abbr: 'MT', tz: 'America/Denver' },
  { name: 'Pacific', abbr: 'PT', tz: 'America/Los_Angeles' },
  { name: 'Alaska', abbr: 'AK', tz: 'America/Anchorage' },
  { name: 'Hawaii', abbr: 'HI', tz: 'Pacific/Honolulu' },
];

export const STANDARD: [number, number, string, string, string][] = [
  [0, 420, 'Sleep', 'off', ''],
  [420, 510, 'Wake · breakfast · slow start', 'off', 'Phone down. Ease into the day.'],
  [510, 570, 'Train / personal', 'move', 'Workout or personal block.'],
  [570, 720, 'Block 1 · Business Hours', 'call', 'Decision-makers, follow-ups, callbacks.'],
  [720, 870, 'Midday Reset', 'off', 'The dead calling window. Protect this.'],
  [870, 1020, 'Block 2 · Afternoon', 'call', 'West coast waking up, east coast nearing prime.'],
  [1020, 1080, 'Dinner', 'meal', 'Step away. Protected time.'],
  [1080, 1260, 'Block 3 · Evening Prime', 'call', 'The money window. Sweep every PRIME zone.'],
  [1260, 1440, 'Off · recover', 'off', 'Hard stop on dials.'],
];

export const ISLAND: [number, number, string, string, string][] = [
  [0, 540, 'Sleep in', 'off', 'Recover.'],
  [540, 630, 'Wake · breakfast', 'off', 'Relaxed start.'],
  [630, 720, 'Train / personal', 'move', 'Front-load personal time.'],
  [720, 810, 'Lunch', 'off', 'Fuel up.'],
  [810, 960, 'Block 1 · Midday', 'call', 'Western zones now open.'],
  [960, 1080, 'Block 2 · East Prime', 'call', 'Eastern + central first.'],
  [1080, 1140, 'Dinner', 'meal', 'Eat before the late push.'],
  [1140, 1320, 'Block 3 · West Prime', 'call', 'Mountain & Pacific after-work.'],
  [1320, 1440, 'Late Push · Islands', 'hawaii', 'Hawaii & Alaska when they pick up.'],
];

export function partsIn(tz: string, date: Date) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, weekday: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const o: Record<string, string> = {};
  p.forEach((x) => { o[x.type] = x.value; });
  return { h: parseInt(o.hour, 10) % 24, m: parseInt(o.minute, 10), s: parseInt(o.second, 10), wd: o.weekday };
}

export function fmt12(h: number, m: number) {
  const mer = h < 12 ? 'AM' : 'PM';
  let hh = h % 12; if (hh === 0) hh = 12;
  return { t: `${hh}:${String(m).padStart(2, '0')}`, mer };
}

export function statusFor(h: number) {
  if (h < 8 || h >= 21) return 'closed' as const;
  if (h >= 17) return 'prime' as const;
  return 'open' as const;
}
