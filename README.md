# QuackedDialer

Multi-user sales performance OS for life insurance teams. White-labels to the agent's selected team.

## Stack
- React + Vite frontend
- Hono API + Postgres
- Railway deploy

## Branding
- Platform: **QuackedDialer**
- After team select: header/splash chrome uses **team name** + team colors
- Seeded teams: **WOLFPACK DIRECT**, **YN's**

## Roles
- `agent` — personal tracker + leads + plan
- `manager` — team roster + integration log + leaderboard
- `admin` — all teams, create teams, elevate roles

Set `BOOTSTRAP_ADMIN_EMAIL` so the first matching account becomes admin.

## Features (current)
- **Left hamburger menu** (replaces bottom bar) — expands on click; persistent sidebar on desktop
- **Editable day plan** — Standard / Island presets + full custom block editor, saved per user
- **Leads workspace** — upload CSV, list/filter, Call opens native `tel:`, SMS opens `sms:`
- Daily counters, deals, leaderboard, team admin

## Local
```bash
npm install
# set DATABASE_URL + SESSION_SECRET
npm run dev
```

## Railway
Connected to `Dcid1218/Sales-Dialer-` main. Push deploys automatically.
