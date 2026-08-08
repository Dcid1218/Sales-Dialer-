import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './lib/api.ts';
import {
  applyBrand, blankDay, dayKey, type DayLog, type Settings, type User,
} from './lib/core.ts';
import { Toast } from './components/ui.tsx';
import { BrandMark } from './components/BrandMark.tsx';
import { PLATFORM_BRAND } from './lib/brand.ts';
import Welcome from './components/Welcome.tsx';
import Onboarding from './components/Onboarding.tsx';
import Today from './views/Today.tsx';
import Schedule from './views/Schedule.tsx';
import Stats from './views/Stats.tsx';
import Board from './views/Board.tsx';
import Manage from './views/Manage.tsx';
import Admin from './views/Admin.tsx';
import Profile from './views/Profile.tsx';
import Deals from './views/Deals.tsx';
import Leads from './views/Leads.tsx';

export type Store = {
  user: User;
  setUser: (u: User) => void;
  days: Record<string, DayLog>;
  settings: Settings;
  reload: () => Promise<void>;
  bump: (k: keyof DayLog, delta: number) => Promise<void>;
  savePremium: (amt: number, alsoSale: boolean) => Promise<void>;
  say: (msg: string) => void;
};

type Tab = 'today' | 'schedule' | 'stats' | 'deals' | 'leads' | 'board' | 'manage' | 'admin' | 'profile';
type Gate = 'checking' | 'welcome' | 'onboard' | 'open';

const DEFAULT_SETTINGS: Settings = {
  annual: 150000, comm: 75, workdays: 6, dialGoal: 100,
  crmUrl: '', crmKey: '', dialerUrl: '', dialerKey: '',
};

export default function App() {
  const [gate, setGate] = useState<Gate>('checking');
  const [user, setUser] = useState<User | null>(null);
  const [days, setDays] = useState<Record<string, DayLog>>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<Tab>('today');
  const [toast, setToast] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const toastTimer = useRef<number>();

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  const reload = useCallback(async () => {
    const data = await api.state();
    setDays(data.days || {});
    setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
    if (data.user) {
      setUser(data.user);
      applyBrand(data.user.team_brand || PLATFORM_BRAND);
    }
  }, []);

  const enter = useCallback(async (u: User) => {
    setUser(u);
    applyBrand(u.team_brand || PLATFORM_BRAND);
    if (!u.onboarded || !u.team_id) {
      setGate('onboard');
      return;
    }
    await reload();
    setGate('open');
  }, [reload]);

  useEffect(() => {
    api.session()
      .then(async ({ unlocked, user: u }) => {
        if (!unlocked || !u) return setGate('welcome');
        await enter(u);
      })
      .catch(() => setGate('welcome'));

    const onLocked = () => {
      setUser(null); setDays({}); setGate('welcome');
    };
    window.addEventListener('quacked:locked', onLocked);
    return () => window.removeEventListener('quacked:locked', onLocked);
  }, [enter]);

  const bump = useCallback(async (k: keyof DayLog, delta: number) => {
    const key = dayKey();
    const cur = days[key] || blankDay();
    const next = { ...cur, [k]: Math.max(0, Number(cur[k] || 0) + delta) };
    setDays((d) => ({ ...d, [key]: next }));
    await api.saveDay(key, next);
  }, [days]);

  const savePremium = useCallback(async (amt: number, alsoSale: boolean) => {
    const key = dayKey();
    const cur = days[key] || blankDay();
    const next = {
      ...cur,
      premium: Number(cur.premium || 0) + amt,
      sales: alsoSale ? Number(cur.sales || 0) + 1 : cur.sales,
    };
    setDays((d) => ({ ...d, [key]: next }));
    await api.saveDay(key, next);
  }, [days]);

  const tabs = useMemo(() => {
    const base: { id: Tab; label: string }[] = [
      { id: 'today', label: 'Today' },
      { id: 'leads', label: 'Leads' },
      { id: 'schedule', label: 'Plan' },
      { id: 'stats', label: 'Stats' },
      { id: 'deals', label: 'Deals' },
      { id: 'board', label: 'Board' },
      { id: 'profile', label: 'You' },
    ];
    if (user?.role === 'manager' || user?.role === 'admin') {
      base.splice(6, 0, { id: 'manage', label: 'Team' });
    }
    if (user?.role === 'admin') {
      base.splice(7, 0, { id: 'admin', label: 'Admin' });
    }
    return base;
  }, [user?.role]);

  if (gate === 'checking') return <div className="boot" />;
  if (gate === 'welcome') return <Welcome onAuthed={enter} />;
  if (gate === 'onboard' && user) {
    return (
      <Onboarding
        user={user}
        onDone={async (u) => {
          setUser(u);
          applyBrand(u.team_brand || PLATFORM_BRAND);
          await reload();
          setGate('open');
        }}
      />
    );
  }
  if (!user) return <Welcome onAuthed={enter} />;

  const store: Store = { user, setUser, days, settings, reload, bump, savePremium, say };
  const brand = user.team_brand || PLATFORM_BRAND;
  const Screen = {
    today: Today, schedule: Schedule, stats: Stats, deals: Deals, leads: Leads, board: Board,
    manage: Manage, admin: Admin, profile: Profile,
  }[tab];

  const go = (id: Tab) => {
    setTab(id);
    setNavOpen(false);
  };

  return (
    <>
      <div className="bgfx golf"><div className="blob g" /><div className="blob e" /></div>

      <div className={`nav-scrim ${navOpen ? 'open' : ''}`} onClick={() => setNavOpen(false)} aria-hidden={!navOpen} />
      <aside className={`sidenav ${navOpen ? 'open' : ''}`} aria-label="Main navigation">
        <div className="sidenav-head">
          <BrandMark brand={brand} variant="header" />
          <div className="logo-copy">
            <div className="wm">{brand.appName || user.team_name || 'QuackedDialer'}</div>
            <div className="tag">{brand.tagline || 'Sales Performance OS'}</div>
          </div>
          <button type="button" className="sidenav-close" onClick={() => setNavOpen(false)} aria-label="Close menu">×</button>
        </div>
        <nav className="sidenav-links">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'on' : ''}
              onClick={() => go(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="sidenav-foot">
          <span className="role-pill">{user.role}</span>
        </div>
      </aside>

      <div className="app shell">
        <header className="topbar">
          <button
            type="button"
            className="hamburger"
            onClick={() => setNavOpen((o) => !o)}
            aria-label="Open menu"
            aria-expanded={navOpen}
          >
            <span /><span /><span />
          </button>
          <div className="logo">
            <BrandMark brand={brand} variant="header" />
            <div className="logo-copy">
              <div className="wm">{brand.appName || user.team_name || 'QuackedDialer'}</div>
              <div className="tag">{brand.tagline || 'Sales Performance OS'}</div>
            </div>
          </div>
          <div className="h-right">
            <span className="role-pill">{user.role}</span>
          </div>
        </header>

        <main className="screen">
          <Screen store={store} />
        </main>
      </div>

      {toast && <Toast text={toast} />}
    </>
  );
}
