# ASCEND Dialer

Multi-user sales performance OS for life insurance teams.

## Stack
- React + Vite frontend
- Hono API + Postgres
- Railway deploy

## Teams
Seeded:
- **WOLFPACK DIRECT** (`wolfpack-direct`)
- **YN's** (`yns`)

Admins can create more teams.

## Roles
- `agent` — personal tracker
- `manager` — team roster + integration log + leaderboard
- `admin` — all teams, create teams, elevate roles

Set `BOOTSTRAP_ADMIN_EMAIL` so the first matching account becomes admin.

## Local
```bash
npm install
# set DATABASE_URL + SESSION_SECRET
npm run dev
```

## Railway
1. New project + Postgres
2. Service from this repo
3. Variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `SESSION_SECRET`, optional `BOOTSTRAP_ADMIN_EMAIL`
4. Deploy (`npm run build` + `npm start`)

## GitHub Pages
Disabled — app is server-backed and no longer static-only.
