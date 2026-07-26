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

const GREEN = '#0B5C3B';
const GOLD = '#C4A35A';
const CREAM = '#F7F5F0';

const DEFAULT_AGENCY = {
  appName: 'QuackedDialer',
  tagline: 'Sales Performance OS',
  primary: GOLD,
  accent: GREEN,
  logoText: 'QD',
  logoUrl: '/brand/quacked-mark.png',
  theme: 'light',
  bg: CREAM,
};

const TEAM_BRANDS = {
  wolfpack: {
    appName: 'WOLFPACK DIRECT',
    tagline: 'Powered by QuackedDialer',
    primary: GOLD,
    accent: GREEN,
    logoText: 'WP',
    logoUrl: '',
    theme: 'light',
    bg: CREAM,
  },
  yns: {
    appName: "YN's",
    tagline: 'Powered by QuackedDialer',
    primary: GOLD,
    accent: GREEN,
    logoText: 'YN',
    logoUrl: '',
    theme: 'light',
    bg: CREAM,
  },
};

export async function migrate() {
  if (!url) throw new Error('DATABASE_URL is not set');

  await pool.query(`
    create table if not exists agencies (
      id          uuid primary key default gen_random_uuid(),
      slug        text not null unique,
      name        text not null,
      logo        text,
      brand       jsonb not null default '{}',
      active      boolean not null default true,
      created_at  timestamptz not null default now()
    );

    create table if not exists teams (
      id          uuid primary key default gen_random_uuid(),
      slug        text not null unique,
      name        text not null,
      agency_id   uuid references agencies(id) on delete set null,
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

      /* legacy teams may lack agency_id — must run before any agency_id index */
      await pool.query(`
        do $$ begin
          if not exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'teams' and column_name = 'agency_id'
          ) then
            alter table teams add column agency_id uuid references agencies(id) on delete set null;
          end if;
        end $$;
      `);
      await pool.query(`create index if not exists teams_agency_idx on teams(agency_id)`);

      const [agency] = await q<any>(
    `insert into agencies (slug, name, logo, brand)
     values ('quacked-dialer', 'QuackedDialer', '/brand/quacked-mark.png', $1::jsonb)
     on conflict (slug) do update set
       name = excluded.name,
       logo = coalesce(nullif(agencies.logo, ''), excluded.logo),
       brand = excluded.brand
     returning *`,
    [JSON.stringify(DEFAULT_AGENCY)],
  );

  await pool.query(
    `insert into teams (slug, name, agency_id, brand)
     values
       ('wolfpack-direct', 'WOLFPACK DIRECT', $1, $2::jsonb),
       ('yns', 'YN''s', $1, $3::jsonb)
     on conflict (slug) do update set
       agency_id = coalesce(teams.agency_id, excluded.agency_id),
       name = excluded.name,
       brand = case
         when teams.brand ? 'logoUrl' and nullif(teams.brand->>'logoUrl','') is not null
         then teams.brand || jsonb_build_object(
           'primary', excluded.brand->>'primary',
           'accent', excluded.brand->>'accent',
           'bg', excluded.brand->>'bg',
           'theme', excluded.brand->>'theme',
           'tagline', excluded.brand->>'tagline'
         )
         else excluded.brand
       end`,
    [agency.id, JSON.stringify(TEAM_BRANDS.wolfpack), JSON.stringify(TEAM_BRANDS.yns)],
  );

  console.log('schema ready');
}
