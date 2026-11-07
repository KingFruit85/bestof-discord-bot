# Best-Of Dashboard

A read-only view of the best-of bot's database: rotation progress, recent random posts, all nominations, voting stats, and server settings. It is a separate Next.js app and shares no code with the bot.

## Run locally

```bash
cd dashboard
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

The bot's health-check server also defaults to port 3000. If both run at once, start the dashboard with `npm run dev -- -p 3001`.

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `DASHBOARD_DATABASE_URL` | yes | Neon pooled connection string for the read-only role below |
| `DASHBOARD_SERVER_NAMES` | no | JSON object mapping server IDs to display names. Unknown IDs show raw. |
| `DASHBOARD_PASSWORD` | on Vercel | Password for the browser's login prompt (any username). Unset locally means no prompt. Unset on Vercel means every request gets a 503, so a forgotten variable can't leave it open. |

The password is mainly there to stop crawlers and bots: every page load runs several database queries, which count against Neon's free-tier compute. Rejected requests are stopped in `proxy.ts` before the page or the database is touched.

Server names live in env rather than a file because the repo is public.

## Read-only database role

Create the role once, in the Neon console's SQL editor or with `psql` as the database owner. Replace the password.

```sql
CREATE ROLE dashboard_ro WITH LOGIN PASSWORD 'choose-a-strong-password';
GRANT CONNECT ON DATABASE neondb TO dashboard_ro;
GRANT USAGE ON SCHEMA public TO dashboard_ro;
GRANT SELECT ON nominations, votes, guild_config, schedule_history TO dashboard_ro;
```

The dashboard also puts every connection in read-only mode, as a second safeguard.

## Tests

```bash
npm test          # unit tests for lib/format.ts
npm run type-check
```

## Deploying to Vercel (later)

1. Import the repo in Vercel and set **Root Directory** to `dashboard`.
2. Add `DASHBOARD_DATABASE_URL`, `DASHBOARD_PASSWORD`, and `DASHBOARD_SERVER_NAMES` as project environment variables. Use the read-only role's **pooled** connection string. Don't use the owner role through the pooler: it would share pgbouncer connections with the bot, and the dashboard's per-connection read-only setting could leak onto them.
3. Set **Ignored Build Step** to `git diff --quiet HEAD^ HEAD -- .` so bot-only commits don't trigger a dashboard build. (Vercel runs it from the root directory, so `.` means `dashboard/`.)

The bot's Fly deploy already ignores this folder: `.dockerignore` excludes it, and the deploy workflow skips pushes that only change `dashboard/`.
