import type { DayLog, Settings, Team, User } from './core.ts';

async function raw(method: string, path: string, body?: any) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('quacked:locked'));
    throw new Error('locked');
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${method} ${path} failed`);
  return res.status === 204 ? null : res.json();
}

export const api = {
  health: () => raw('GET', '/health'),
  session: () => raw('GET', '/session') as Promise<{ unlocked: boolean; user: User | null }>,
  teams: () => raw('GET', '/teams') as Promise<{ teams: Team[] }>,
  register: (b: { email: string; password: string; name?: string }) =>
    raw('POST', '/register', b) as Promise<{ unlocked: boolean; user: User }>,
  login: (b: { email: string; password: string }) =>
    raw('POST', '/login', b) as Promise<{ unlocked: boolean; user: User }>,
  logout: () => raw('POST', '/logout'),
  updateMe: (b: any) => raw('PATCH', '/me', b) as Promise<{ user: User }>,
  state: () => raw('GET', '/state') as Promise<{
    user: User; settings: Settings; days: Record<string, DayLog>; now: string;
  }>,
  saveDay: (day: string, log: DayLog) => raw('PUT', `/days/${day}`, log),
  saveSettings: (b: any) => raw('PUT', '/settings', b),
  importDays: (b: any) => raw('POST', '/days/import', b) as Promise<{ imported: number }>,
  leaderboard: (days = 7, teamId?: string) =>
    raw('GET', `/leaderboard?days=${days}${teamId ? `&team_id=${teamId}` : ''}`),
  teamMembers: (teamId?: string) =>
    raw('GET', `/team/members${teamId ? `?team_id=${teamId}` : ''}`),
  setMemberRole: (id: string, role: string) => raw('PATCH', `/team/members/${id}/role`, { role }),
  adminTeams: () => raw('GET', '/admin/teams'),
  createTeam: (b: any) => raw('POST', '/admin/teams', b),
  updateTeam: (id: string, b: any) => raw('PATCH', `/admin/teams/${id}`, b),
  adminAgencies: () => raw('GET', '/admin/agencies'),
  createAgency: (b: any) => raw('POST', '/admin/agencies', b),
  updateAgency: (id: string, b: any) => raw('PATCH', `/admin/agencies/${id}`, b),
  assignUserTeam: (id: string, b: any) => raw('POST', `/admin/users/${id}/team`, b),
  crmSync: () => raw('POST', '/integrations/crm/sync'),
  dialerStart: (b?: any) => raw('POST', '/integrations/dialer/start', b || {}),
  integrationsLog: () => raw('GET', '/integrations/log'),
  deals: (scope: 'mine' | 'team' | 'all' = 'mine') => raw('GET', `/deals?scope=${scope}`),
  createDeal: (b: { annual_premium: number; carrier: string; draft_date: string; note?: string }) =>
    raw('POST', '/deals', b),
  deleteDeal: (id: string) => raw('DELETE', `/deals/${id}`),

  schedule: () => raw('GET', '/schedule') as Promise<{
    mode: string; blocks: any[]; source: string; team: any; hasUserOverride: boolean;
  }>,
  saveSchedule: (b: { mode: string; blocks: any[] }) => raw('PUT', '/schedule', b),
  clearSchedule: () => raw('DELETE', '/schedule'),
  teamSchedule: () => raw('GET', '/team/schedule') as Promise<{ mode: string; blocks: any[]; name: string }>,
  saveTeamSchedule: (b: { mode: string; blocks: any[]; name?: string }) => raw('PUT', '/team/schedule', b),

  leads: (opts?: { status?: string; q?: string; limit?: number; scope?: string }) => {
    const p = new URLSearchParams();
    if (opts?.status) p.set('status', opts.status);
    if (opts?.q) p.set('q', opts.q);
    if (opts?.limit) p.set('limit', String(opts.limit));
    if (opts?.scope) p.set('scope', opts.scope);
    const qs = p.toString();
    return raw('GET', `/leads${qs ? `?${qs}` : ''}`) as Promise<{ leads: any[]; counts: { status: string; n: number }[]; scope: string }>;
  },
  lead: (id: string) => raw('GET', `/leads/${id}`) as Promise<{ lead: any; events: any[] }>,
  importLeads: (rows: Record<string, string>[], shared = false) =>
    raw('POST', '/leads/import', { rows, shared }) as Promise<{ ok: boolean; imported: number; skipped: number }>,
  updateLead: (id: string, b: any) => raw('PATCH', `/leads/${id}`, b) as Promise<{ lead: any }>,
  bulkLeads: (b: { ids: string[]; status?: string; shared?: boolean; action?: string }) =>
    raw('POST', '/leads/bulk', b) as Promise<{ ok: boolean; updated: number }>,
  nextLead: (opts?: { after?: string; scope?: string }) => {
    const p = new URLSearchParams();
    if (opts?.after) p.set('after', opts.after);
    if (opts?.scope) p.set('scope', opts.scope);
    const qs = p.toString();
    return raw('GET', `/leads/queue/next${qs ? `?${qs}` : ''}`) as Promise<{ lead: any | null }>;
  },
  leadEvent: (id: string, b: { kind: string; detail?: any }) => raw('POST', `/leads/${id}/event`, b),
  deleteLead: (id: string) => raw('DELETE', `/leads/${id}`),
};
