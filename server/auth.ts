import { createHmac, timingSafeEqual, randomBytes, scryptSync } from 'node:crypto';
import type { Context, Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { q, q1 } from './db.ts';

const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const COOKIE = 'ascend_session';
const MAX_AGE = 60 * 60 * 24 * 180;

if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set. Sessions will drop on every restart.');
}

export type Role = 'agent' | 'manager' | 'admin';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: Role;
  team_id: string | null;
  onboarded: boolean;
  team_slug?: string | null;
  team_name?: string | null;
  team_brand?: any;
};

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

function sign(payload: string) {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function cookieSecure() {
  return Boolean(process.env.RAILWAY_PUBLIC_DOMAIN) || process.env.NODE_ENV === 'production';
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64).toString('hex');
  return safeEqual(next, hash);
}

export function issue(c: Context, userId: string, epoch: number) {
  const expires = Date.now() + MAX_AGE * 1000;
  const payload = `${userId}:${expires}:${epoch}`;
  setCookie(c, COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: cookieSecure(),
    path: '/',
    maxAge: MAX_AGE,
  });
}

export function clearSession(c: Context) {
  deleteCookie(c, COOKIE, { path: '/' });
}

export async function revoke(c: Context, userId: string) {
  clearSession(c);
  await q(`update users set session_epoch = session_epoch + 1 where id = $1`, [userId]);
}

export async function readSession(c: Context): Promise<AuthUser | null> {
  const raw = getCookie(c, COOKIE);
  if (!raw) return null;
  const cut = raw.lastIndexOf('.');
  if (cut < 1) return null;
  const payload = raw.slice(0, cut);
  const mac = raw.slice(cut + 1);
  if (!safeEqual(mac, sign(payload))) return null;
  const [userId, expires, issuedEpoch] = payload.split(':');
  if (!userId || Number(expires) <= Date.now()) return null;

  const row = await q1<any>(
    `select u.id, u.email, u.name, u.avatar, u.role, u.team_id, u.onboarded, u.session_epoch,
            t.slug as team_slug, t.name as team_name, t.brand as team_brand
     from users u
     left join teams t on t.id = u.team_id
     where u.id = $1`,
    [userId],
  );
  if (!row) return null;
  if (Number(issuedEpoch) !== Number(row.session_epoch)) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar: row.avatar,
    role: row.role,
    team_id: row.team_id,
    onboarded: row.onboarded,
    team_slug: row.team_slug,
    team_name: row.team_name,
    team_brand: row.team_brand,
  };
}

export async function guard(c: Context, next: Next) {
  const user = await readSession(c);
  if (!user) return c.json({ error: 'locked' }, 401);
  c.set('user', user);
  await next();
}

export function requireRole(...roles: Role[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!roles.includes(user.role) && user.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
}

export function publicUser(u: AuthUser) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar: u.avatar,
    role: u.role,
    team_id: u.team_id,
    onboarded: u.onboarded,
    team_slug: u.team_slug ?? null,
    team_name: u.team_name ?? null,
    team_brand: u.team_brand ?? null,
  };
}
