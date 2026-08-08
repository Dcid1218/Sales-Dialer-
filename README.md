# QuackedDialer

Multi-user sales performance OS for life insurance teams. White-labels to the agent's selected team.

## Stack
- React + Vite frontend
- Hono API + Postgres
- Railway deploy

## Features
- **Left hamburger menu** — replaces bottom bar; fixed sidebar on desktop
- **Editable day plan** — Standard / Island / custom blocks; **team-level presets** (managers)
- **Leads workspace**
  - CSV import (personal or team shared pool)
  - Detail sheet: notes, callback time, activity history
  - Bulk status / share / delete
  - Dial queue (Call `tel:` · SMS `sms:`)
  - Manager team-wide visibility
- Daily counters, deals, leaderboard, admin

## Roles
- `agent` — personal tracker + leads + plan
- `manager` — team roster, shared leads, team schedule
- `admin` — all teams

Set `BOOTSTRAP_ADMIN_EMAIL` so the first matching account becomes admin.

## Local
```bash
npm install
# set DATABASE_URL + SESSION_SECRET
npm run dev
```

## Railway
Push to `main` auto-deploys.
