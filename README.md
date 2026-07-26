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
Connected to `Dcid1218/Sales-Dialer-` main. Push deploys automatically.
