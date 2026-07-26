import pg from 'pg';

const { Pool } = pg;
const url = process.env.DATABASE_URL ?? '';

const privateHost = /\.railway\.internal|localhost|127\.0\.0\.1/i.test(url);
const useSsl =
  /sslmode=require/i.test(url) ||
  (!privateHost && /proxy\.rlwy\.net|render\.com|supabase|neon\.tech|amazonaws/i.test(url));

export const pool = new Pool({
  connectionString: url,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function q1<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

const DEFAULT_BRANDS = {
  wolfpack: {
    appName: 'WOLFPACK DIRECT',
    tagline: 'Powered by Zippy CRM',
    primary: '#f5c451',
    accent: '#10d488',
    logoText: 'WP',
    theme: 'dark',
    bg: '#05070a',
  },
  yns: {
    appName: "YN's",
    tagline: 'Powered by Zippy CRM',
    primary: '#7c8cf0',
    accent: '#22d3ee',
    logoText: 'YN',
    theme: 'dark',
    bg: '#07060f',
  },
};

export async function migrate() {
  if (!url) throw new Error('DATABASE_URL is not set');

  await pool.query(`
    create table if not exists teams (
      id          uuid primary key default gen_random_uuid(),
      slug        text not null unique,
      name        text not null,
      brand       jsonb not null default '{}',
      active      boolean not null default true,
      created_at  timestamptz not null default now()
    );

    create table if not exists users (
      id             uuid primary key default gen_random_uuid(),
      email          text not null unique,
      password_hash  text not null,
      name           text not null default '',
      avatar         text,
      role           text not null default 'agent' check (role in ('agent','manager','admin')),
      team_id        uuid references teams(id) on delete set null,
      onboarded      boolean not null default false,
      session_epoch  integer not null default 0,
      created_at     timestamptz not null default now()
    );

    create table if not exists day_logs (
      user_id   uuid not null references users(id) on delete cascade,
      day       date not null,
      dials     integer not null default 0,
      contacts  integer not null default 0,
      appts     integer not null default 0,
      sales     integer not null default 0,
      premium   numeric not null default 0,
      updated_at timestamptz not null default now(),
      primary key (user_id, day)
    );

    create table if not exists user_settings (
      user_id    uuid primary key references users(id) on delete cascade,
      annual     numeric not null default 150000,
      comm       numeric not null default 75,
      workdays   integer not null default 6,
      dial_goal  integer not null default 100,
      crm_url    text not null default '',
      crm_key    text not null default '',
      dialer_url text not null default '',
      dialer_key text not null default '',
      updated_at timestamptz not null default now()
    );

    create table if not exists integrations_log (
      id         uuid primary key default gen_random_uuid(),
      user_id    uuid references users(id) on delete set null,
      team_id    uuid references teams(id) on delete set null,
      kind       text not null,
      status     text not null,
      detail     jsonb not null default '{}',
      created_at timestamptz not null default now()
    );

    create index if not exists users_team_idx on users(team_id);
    create index if not exists day_logs_day_idx on day_logs(day);
    create index if not exists day_logs_user_day_idx on day_logs(user_id, day desc);
  `);

  /* seed fixed teams */
  await pool.query(
    `insert into teams (slug, name, brand)
     values
       ('wolfpack-direct', 'WOLFPACK DIRECT', $1::jsonb),
       ('yns', 'YN''s', $2::jsonb)
     on conflict (slug) do update set name = excluded.name, brand = excluded.brand`,
    [JSON.stringify(DEFAULT_BRANDS.wolfpack), JSON.stringify(DEFAULT_BRANDS.yns)],
  );

  console.log('schema ready');
}
