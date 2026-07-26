import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFileSync, existsSync } from 'node:fs';
import { q, q1, migrate } from './db.ts';
import {
  guard, issue, revoke, clearSession, readSession, hashPassword, verifyPassword,
  publicUser, requireRole, type AuthUser,
} from './auth.ts';

const app = new Hono();
const api = new Hono();
let dbReady = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_AVATAR = 600_000;
const BOOTSTRAP_ADMIN = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();

function uid(c: any) { return (c.get('user') as AuthUser).id; }

async function ensureSettings(userId: string) {
  await q(
    `insert into user_settings (user_id) values ($1) on conflict (user_id) do nothing`,
    [userId],
  );
}

async function loadUser(id: string): Promise<AuthUser | null> {
  const row = await q1<any>(
    `select u.id, u.email, u.name, u.avatar, u.role, u.team_id, u.onboarded,
            t.slug as team_slug, t.name as team_name, t.brand as team_brand
     from users u left join teams t on t.id = u.team_id where u.id = $1`,
    [id],
  );
  return row as AuthUser | null;
}

api.get('/health', (c) => c.json({ ok: true, db: dbReady }));

api.get('/teams', async (c) => {
  const rows = await q(
    `select t.id, t.slug, t.name, t.brand, t.agency_id,
            a.name as agency_name, a.logo as agency_logo, a.brand as agency_brand
     from teams t
     left join agencies a on a.id = t.agency_id
     where t.active = true
     order by a.name nulls last, t.name`,
  );
  return c.json({ teams: rows });
});

api.get('/session', async (c) => {
  const user = await readSession(c);
  if (!user) return c.json({ unlocked: false, user: null });
  return c.json({ unlocked: true, user: publicUser(user) });
});

api.post('/register', async (c) => {
  const b = await c.req.json<any>();
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const name = String(b.name || '').trim();
  if (!EMAIL_RE.test(email)) return c.json({ error: 'Enter a valid email.' }, 400);
  if (password.length < 8) return c.json({ error: 'Password needs at least 8 characters.' }, 400);

  const exists = await q1(`select id from users where email = $1`, [email]);
  if (exists) {
    await new Promise((r) => setTimeout(r, 300));
    return c.json({ error: 'That email is already registered.' }, 409);
  }

  const role = BOOTSTRAP_ADMIN && email === BOOTSTRAP_ADMIN ? 'admin' : 'agent';
  const [user] = await q<any>(
    `insert into users (email, password_hash, name, role)
     values ($1,$2,$3,$4)
     returning id, email, name, avatar, role, team_id, onboarded, session_epoch`,
    [email, hashPassword(password), name, role],
  );
  await ensureSettings(user.id);
  issue(c, user.id, user.session_epoch);
  const full = await loadUser(user.id);
  return c.json({ unlocked: true, user: publicUser(full!) }, 201);
});

api.post('/login', async (c) => {
  const b = await c.req.json<any>();
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const row = await q1<any>(`select * from users where email = $1`, [email]);
  if (!row || !verifyPassword(password, row.password_hash)) {
    await new Promise((r) => setTimeout(r, 400));
    return c.json({ error: 'Email or password is wrong.' }, 401);
  }
  if (BOOTSTRAP_ADMIN && email === BOOTSTRAP_ADMIN && row.role === 'agent') {
    await q(`update users set role = 'admin' where id = $1`, [row.id]);
    row.role = 'admin';
  }
  issue(c, row.id, row.session_epoch);
  const full = await loadUser(row.id);
  return c.json({ unlocked: true, user: publicUser(full!) });
});

api.post('/logout', async (c) => {
  const user = await readSession(c);
  if (user) await revoke(c, user.id);
  else clearSession(c);
  return c.json({ unlocked: false });
});

api.use('/*', async (c, next) => {
  const open = ['/health', '/session', '/register', '/login', '/logout', '/teams'];
  const path = c.req.path.replace(/^\/api/, '') || c.req.path;
  if (open.includes(path)) return next();
  return guard(c, next);
});

api.get('/me', (c) => c.json({ user: publicUser(c.get('user')) }));

api.patch('/me', async (c) => {
  const user = c.get('user');
  const b = await c.req.json<any>();
  const fields: string[] = [];
  const vals: any[] = [];

  if (typeof b.name === 'string') {
    fields.push(`name = $${fields.length + 1}`);
    vals.push(b.name.trim().slice(0, 80));
  }
  if (b.avatar === null) fields.push(`avatar = null`);
  else if (typeof b.avatar === 'string') {
    if (b.avatar.length > MAX_AVATAR) return c.json({ error: 'Image is too large.' }, 400);
    if (b.avatar && !b.avatar.startsWith('data:image/')) return c.json({ error: 'Avatar must be an image.' }, 400);
    fields.push(`avatar = $${fields.length + 1}`);
    vals.push(b.avatar || null);
  }
  if (typeof b.onboarded === 'boolean') {
    fields.push(`onboarded = $${fields.length + 1}`);
    vals.push(b.onboarded);
  }
  if (typeof b.team_id === 'string' && !user.team_id) {
    const team = await q1(`select id from teams where id = $1 and active = true`, [b.team_id]);
    if (!team) return c.json({ error: 'Team not found.' }, 404);
    fields.push(`team_id = $${fields.length + 1}`);
    vals.push(b.team_id);
  }
  if (!fields.length) return c.json({ error: 'nothing to change' }, 400);
  vals.push(user.id);
  await q(`update users set ${fields.join(', ')} where id = $${vals.length}`, vals);
  const full = await loadUser(user.id);
  return c.json({ user: publicUser(full!) });
});

/* ── state ───────────────────────────────────────────────────────────── */

api.get('/state', async (c) => {
  const user = c.get('user');
  await ensureSettings(user.id);
  const since = new Date();
  since.setDate(since.getDate() - 400);
  const day = since.toISOString().slice(0, 10);

  const [settings, days] = await Promise.all([
    q1(`select annual, comm, workdays, dial_goal, crm_url, crm_key, dialer_url, dialer_key from user_settings where user_id = $1`, [user.id]),
    q(
      `select to_char(day,'YYYY-MM-DD') as day, dials, contacts, appts, sales, premium
       from day_logs where user_id = $1 and day >= $2 order by day`,
      [user.id, day],
    ),
  ]);

  const daysMap: Record<string, any> = {};
  for (const d of days as any[]) {
    daysMap[d.day] = {
      dials: Number(d.dials), contacts: Number(d.contacts), appts: Number(d.appts),
      sales: Number(d.sales), premium: Number(d.premium),
    };
  }

  return c.json({
    user: publicUser(user),
    settings: {
      annual: Number(settings?.annual ?? 150000),
      comm: Number(settings?.comm ?? 75),
      workdays: Number(settings?.workdays ?? 6),
      dialGoal: Number(settings?.dial_goal ?? 100),
      crmUrl: settings?.crm_url ?? '',
      crmKey: settings?.crm_key ? '••••' : '',
      dialerUrl: settings?.dialer_url ?? '',
      dialerKey: settings?.dialer_key ? '••••' : '',
      hasCrmKey: Boolean(settings?.crm_key),
      hasDialerKey: Boolean(settings?.dialer_key),
    },
    days: daysMap,
    now: new Date().toISOString(),
  });
});

api.put('/settings', async (c) => {
  const userId = uid(c);
  await ensureSettings(userId);
  const b = await c.req.json<any>();
  const cur = await q1<any>(`select * from user_settings where user_id = $1`, [userId]);
  await q(
    `update user_settings set
      annual = $2, comm = $3, workdays = $4, dial_goal = $5,
      crm_url = $6,
      crm_key = case when $7::text is null then crm_key when $7 = '' then '' else $7 end,
      dialer_url = $8,
      dialer_key = case when $9::text is null then dialer_key when $9 = '' then '' else $9 end,
      updated_at = now()
     where user_id = $1`,
    [
      userId,
      b.annual ?? cur?.annual ?? 150000,
      b.comm ?? cur?.comm ?? 75,
      b.workdays ?? cur?.workdays ?? 6,
      b.dialGoal ?? cur?.dial_goal ?? 100,
      b.crmUrl ?? cur?.crm_url ?? '',
      b.crmKey === undefined ? null : b.crmKey,
      b.dialerUrl ?? cur?.dialer_url ?? '',
      b.dialerKey === undefined ? null : b.dialerKey,
    ],
  );
  return c.json({ ok: true });
});

api.put('/days/:day', async (c) => {
  const userId = uid(c);
  const day = c.req.param('day');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return c.json({ error: 'bad day' }, 400);
  const b = await c.req.json<any>();
  const [row] = await q(
    `insert into day_logs (user_id, day, dials, contacts, appts, sales, premium, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7, now())
     on conflict (user_id, day) do update set
       dials = excluded.dials, contacts = excluded.contacts, appts = excluded.appts,
       sales = excluded.sales, premium = excluded.premium, updated_at = now()
     returning to_char(day,'YYYY-MM-DD') as day, dials, contacts, appts, sales, premium`,
    [
      userId, day,
      Math.max(0, Number(b.dials) || 0),
      Math.max(0, Number(b.contacts) || 0),
      Math.max(0, Number(b.appts) || 0),
      Math.max(0, Number(b.sales) || 0),
      Math.max(0, Number(b.premium) || 0),
    ],
  );
  return c.json(row);
});

api.post('/days/import', async (c) => {
  const userId = uid(c);
  const b = await c.req.json<any>();
  const payload = b.days || b;
  if (!payload || typeof payload !== 'object') return c.json({ error: 'Expected days map.' }, 400);

  let n = 0;
  for (const [day, rec] of Object.entries(payload as Record<string, any>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const r = rec || {};
    await q(
      `insert into day_logs (user_id, day, dials, contacts, appts, sales, premium, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7, now())
       on conflict (user_id, day) do update set
         dials = greatest(day_logs.dials, excluded.dials),
         contacts = greatest(day_logs.contacts, excluded.contacts),
         appts = greatest(day_logs.appts, excluded.appts),
         sales = greatest(day_logs.sales, excluded.sales),
         premium = greatest(day_logs.premium, excluded.premium),
         updated_at = now()`,
      [
        userId, day,
        Math.max(0, Number(r.dials) || 0),
        Math.max(0, Number(r.contacts) || 0),
        Math.max(0, Number(r.appts) || 0),
        Math.max(0, Number(r.sales) || 0),
        Math.max(0, Number(r.premium) || 0),
      ],
    );
    n += 1;
  }
  if (b.settings && typeof b.settings === 'object') {
    await ensureSettings(userId);
    const s = b.settings;
    await q(
      `update user_settings set
         annual = coalesce($2, annual),
         comm = coalesce($3, comm),
         workdays = coalesce($4, workdays),
         dial_goal = coalesce($5, dial_goal),
         updated_at = now()
       where user_id = $1`,
      [userId, s.annual ?? null, s.comm ?? null, s.workdays ?? null, s.dialGoal ?? s.dial_goal ?? null],
    );
  }
  return c.json({ imported: n });
});

/* ── leaderboard ─────────────────────────────────────────────────────── */

api.get('/leaderboard', async (c) => {
  const user = c.get('user');
  const days = Math.min(90, Math.max(1, Number(c.req.query('days') || 7)));
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const day = since.toISOString().slice(0, 10);

  let teamFilter = '';
  const params: any[] = [day];
  if (user.role !== 'admin') {
    if (!user.team_id) return c.json({ rows: [] });
    teamFilter = 'and u.team_id = $2';
    params.push(user.team_id);
  } else if (c.req.query('team_id')) {
    teamFilter = 'and u.team_id = $2';
    params.push(c.req.query('team_id'));
  }

  const rows = await q(
    `select u.id, u.name, u.avatar, u.role, t.name as team_name, t.slug as team_slug,
            coalesce(sum(d.dials),0)::int as dials,
            coalesce(sum(d.contacts),0)::int as contacts,
            coalesce(sum(d.appts),0)::int as appts,
            coalesce(sum(d.sales),0)::int as sales,
            coalesce(sum(d.premium),0)::float as premium
     from users u
     left join teams t on t.id = u.team_id
     left join day_logs d on d.user_id = u.id and d.day >= $1
     where u.team_id is not null ${teamFilter}
     group by u.id, t.name, t.slug
     order by premium desc, dials desc
     limit 100`,
    params,
  );
  return c.json({ days, rows });
});

/* ── manager ─────────────────────────────────────────────────────────── */

api.get('/team/members', requireRole('manager', 'admin'), async (c) => {
  const user = c.get('user');
  const teamId = user.role === 'admin' ? (c.req.query('team_id') || user.team_id) : user.team_id;
  if (!teamId) return c.json({ members: [] });
  const members = await q(
    `select id, name, email, avatar, role, onboarded, created_at
     from users where team_id = $1 order by name`,
    [teamId],
  );
  return c.json({ members });
});

api.patch('/team/members/:id/role', requireRole('manager', 'admin'), async (c) => {
  const actor = c.get('user');
  const id = c.req.param('id');
  const { role } = await c.req.json<{ role?: string }>();
  if (!role || !['agent', 'manager'].includes(role)) {
    if (!(actor.role === 'admin' && role === 'admin')) {
      return c.json({ error: 'Invalid role.' }, 400);
    }
  }
  const target = await q1<any>(`select * from users where id = $1`, [id]);
  if (!target) return c.json({ error: 'not found' }, 404);
  if (actor.role !== 'admin' && target.team_id !== actor.team_id) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  if (actor.role !== 'admin' && role === 'admin') return c.json({ error: 'Forbidden' }, 403);

  await q(`update users set role = $2 where id = $1`, [id, role]);
  return c.json({ ok: true });
});

/* ── admin agencies + teams ──────────────────────────────────────────── */

api.get('/admin/agencies', requireRole('admin'), async (c) => {
  const agencies = await q(
    `select a.*,
            (select count(*)::int from teams tm where tm.agency_id = a.id) as team_count
     from agencies a order by a.name`,
  );
  return c.json({ agencies });
});

api.post('/admin/agencies', requireRole('admin'), async (c) => {
  const b = await c.req.json<any>();
  const name = String(b.name || '').trim();
  const slug = String(b.slug || name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!name || !slug) return c.json({ error: 'Name required.' }, 400);
  const brand = b.brand || {
    appName: name,
    tagline: 'Powered by QuackedDialer',
    primary: '#C4A35A',
    accent: '#0B5C3B',
    logoText: name.slice(0, 2).toUpperCase(),
    logoUrl: b.logo || '',
    theme: 'light',
    bg: '#F7F5F0',
  };
  try {
    const [row] = await q(
      `insert into agencies (slug, name, logo, brand) values ($1,$2,$3,$4::jsonb) returning *`,
      [slug, name, b.logo || brand.logoUrl || null, JSON.stringify(brand)],
    );
    return c.json(row, 201);
  } catch (e: any) {
    if (/unique/i.test(e.message)) return c.json({ error: 'Slug already exists.' }, 409);
    throw e;
  }
});

api.patch('/admin/agencies/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json<any>();
  const fields: string[] = [];
  const vals: any[] = [];
  if (typeof b.name === 'string') { fields.push(`name = $${fields.length + 1}`); vals.push(b.name.trim()); }
  if (typeof b.logo === 'string' || b.logo === null) { fields.push(`logo = $${fields.length + 1}`); vals.push(b.logo); }
  if (b.brand) { fields.push(`brand = $${fields.length + 1}::jsonb`); vals.push(JSON.stringify(b.brand)); }
  if (typeof b.active === 'boolean') { fields.push(`active = $${fields.length + 1}`); vals.push(b.active); }
  if (!fields.length) return c.json({ error: 'nothing' }, 400);
  vals.push(id);
  const [row] = await q(`update agencies set ${fields.join(', ')} where id = $${vals.length} returning *`, vals);
  return c.json(row);
});

api.get('/admin/teams', requireRole('admin'), async (c) => {
  const teams = await q(
    `select t.*, a.name as agency_name, a.logo as agency_logo,
            (select count(*)::int from users u where u.team_id = t.id) as member_count
     from teams t
     left join agencies a on a.id = t.agency_id
     order by a.name nulls last, t.name`,
  );
  return c.json({ teams });
});

api.post('/admin/teams', requireRole('admin'), async (c) => {
  const b = await c.req.json<any>();
  const name = String(b.name || '').trim();
  const slug = String(b.slug || name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!name || !slug) return c.json({ error: 'Name required.' }, 400);
  const brand = b.brand || {
    appName: name,
    tagline: 'Powered by QuackedDialer',
    primary: '#C4A35A',
    accent: '#0B5C3B',
    logoText: name.slice(0, 2).toUpperCase(),
    logoUrl: b.logo || '',
    theme: 'light',
    bg: '#F7F5F0',
  };
  if (b.logo) brand.logoUrl = b.logo;
  try {
    const [row] = await q(
      `insert into teams (slug, name, agency_id, brand) values ($1,$2,$3,$4::jsonb) returning *`,
      [slug, name, b.agency_id || null, JSON.stringify(brand)],
    );
    return c.json(row, 201);
  } catch (e: any) {
    if (/unique/i.test(e.message)) return c.json({ error: 'Slug already exists.' }, 409);
    throw e;
  }
});

api.patch('/admin/teams/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json<any>();
  const fields: string[] = [];
  const vals: any[] = [];
  if (typeof b.name === 'string') { fields.push(`name = $${fields.length + 1}`); vals.push(b.name.trim()); }
  if (b.brand) { fields.push(`brand = $${fields.length + 1}::jsonb`); vals.push(JSON.stringify(b.brand)); }
  if (typeof b.active === 'boolean') { fields.push(`active = $${fields.length + 1}`); vals.push(b.active); }
  if (b.agency_id !== undefined) { fields.push(`agency_id = $${fields.length + 1}`); vals.push(b.agency_id || null); }
  if (!fields.length) return c.json({ error: 'nothing' }, 400);
  vals.push(id);
  const [row] = await q(`update teams set ${fields.join(', ')} where id = $${vals.length} returning *`, vals);
  return c.json(row);
});

api.post('/admin/users/:id/team', requireRole('admin'), async (c) => {
  const { team_id, role } = await c.req.json<any>();
  const id = c.req.param('id');
  await q(
    `update users set team_id = $2, role = coalesce($3, role) where id = $1`,
    [id, team_id || null, role || null],
  );
  return c.json({ ok: true });
});

/* ── integrations: CRM + auto-dialer ─────────────────────────────────── */

api.post('/integrations/crm/sync', async (c) => {
  const user = c.get('user');
  await ensureSettings(user.id);
  const s = await q1<any>(`select * from user_settings where user_id = $1`, [user.id]);
  if (!s?.crm_url) {
    return c.json({
      ok: false,
      error: 'Add a CRM webhook URL in Profile → Integrations first.',
      hint: 'We POST {email,name,days,settings} as JSON to your CRM endpoint.',
    }, 400);
  }

  const days = await q(
    `select to_char(day,'YYYY-MM-DD') as day, dials, contacts, appts, sales, premium
     from day_logs where user_id = $1 and day >= current_date - 30 order by day`,
    [user.id],
  );

  const body = {
    source: 'quacked-dialer',
    synced_at: new Date().toISOString(),
    agent: { id: user.id, email: user.email, name: user.name, team: user.team_name },
    settings: { annual: s.annual, comm: s.comm, workdays: s.workdays, dial_goal: s.dial_goal },
    days,
  };

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (s.crm_key) headers.Authorization = `Bearer ${s.crm_key}`;
    const res = await fetch(s.crm_url, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await res.text();
    await q(
      `insert into integrations_log (user_id, team_id, kind, status, detail)
       values ($1,$2,'crm_sync',$3,$4::jsonb)`,
      [user.id, user.team_id, res.ok ? 'ok' : 'error', JSON.stringify({ status: res.status, body: text.slice(0, 500) })],
    );
    if (!res.ok) return c.json({ ok: false, error: `CRM returned ${res.status}` }, 502);
    return c.json({ ok: true, pushed: days.length });
  } catch (e: any) {
    await q(
      `insert into integrations_log (user_id, team_id, kind, status, detail)
       values ($1,$2,'crm_sync','error',$3::jsonb)`,
      [user.id, user.team_id, JSON.stringify({ message: e.message })],
    );
    return c.json({ ok: false, error: e.message || 'CRM sync failed' }, 502);
  }
});

api.post('/integrations/dialer/start', async (c) => {
  const user = c.get('user');
  await ensureSettings(user.id);
  const s = await q1<any>(`select * from user_settings where user_id = $1`, [user.id]);
  const b = await c.req.json<any>().catch(() => ({}));

  if (!s?.dialer_url) {
    return c.json({
      ok: false,
      error: 'Add an auto-dialer webhook URL in Profile → Integrations.',
      hint: 'We POST a session start payload your dialer can consume (Aircall/JustCall/custom).',
    }, 400);
  }

  const payload = {
    source: 'quacked-dialer',
    action: 'start_session',
    agent: { id: user.id, email: user.email, name: user.name },
    list_id: b.list_id || null,
    started_at: new Date().toISOString(),
  };

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (s.dialer_key) headers.Authorization = `Bearer ${s.dialer_key}`;
    const res = await fetch(s.dialer_url, { method: 'POST', headers, body: JSON.stringify(payload) });
    const text = await res.text();
    await q(
      `insert into integrations_log (user_id, team_id, kind, status, detail)
       values ($1,$2,'dialer_start',$3,$4::jsonb)`,
      [user.id, user.team_id, res.ok ? 'ok' : 'error', JSON.stringify({ status: res.status, body: text.slice(0, 500) })],
    );
    if (!res.ok) return c.json({ ok: false, error: `Dialer returned ${res.status}` }, 502);
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ ok: false, error: e.message || 'Dialer start failed' }, 502);
  }
});

api.get('/integrations/log', requireRole('manager', 'admin'), async (c) => {
  const user = c.get('user');
  const params: any[] = [];
  let where = '';
  if (user.role !== 'admin') {
    where = 'where team_id = $1';
    params.push(user.team_id);
  }
  const rows = await q(
    `select * from integrations_log ${where} order by created_at desc limit 50`,
    params,
  );
  return c.json({ rows });
});

app.onError((err, c) => {
  console.error('unhandled:', err);
  return c.json({ error: err instanceof Error ? err.message : 'Server error' }, 500);
});

app.route('/api', api);

const CLIENT = './dist/client';
app.use('/assets/*', serveStatic({ root: CLIENT }));
app.use('/brand/*', serveStatic({ root: CLIENT }));
app.get('/manifest.webmanifest', serveStatic({ path: `${CLIENT}/manifest.webmanifest` }));
app.get('/favicon.ico', serveStatic({ path: `${CLIENT}/brand/quacked-logo.jpg` }));
const indexPath = `${CLIENT}/index.html`;
const shell = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '<h1>Run npm run build</h1>';
app.get('*', (c) => c.html(shell));

const port = Number(process.env.PORT || 8080);
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (i) =>
  console.log(`quacked-dialer listening on 0.0.0.0:${i.port}`),
);

migrate()
  .then(() => { dbReady = true; console.log('database ready'); })
  .catch((e) => console.error('DATABASE NOT READY —', e.message));
