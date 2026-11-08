# Best-Of Dashboard

A read-only view of the best-of bot's database: leaderboards (most nominated, top nominators, top voters, best taste, biggest fans), a hall of fame, nominations per month, rotation progress, recent random posts, all nominations, voting stats, and server settings. It is a separate Next.js app and shares no code with the bot.

Leaderboards and the hall of fame ignore votes from a message's nominator or author (nominators upvote automatically), and nominator-based boards only count nominations since 12 Dec 2025, because the old bot's imported data mostly records the author as the nominator. Their period filter goes by when the nomination was made: vote timestamps only date from a December 2025 import, so they can't place older votes in time.

Servers listed in `HIDDEN_GUILD_IDS` (`lib/format.ts`) are left out of every panel; it currently hides the bot's dev server. When only one server is visible, the server filter and Server columns are hidden too.

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
| `DASHBOARD_DISCORD_TOKEN` | no | The bot's token, for server and nominator names. Names are looked up live from Discord and cached for a day per ID, never stored, so renames show up within a day. Without it, raw IDs are shown. |
| `DASHBOARD_PASSWORD` | on Vercel | Password for the browser's login prompt (any username). Unset locally means no prompt. Unset on Vercel means every request gets a 503, so a forgotten variable can't leave it open. |

The password is mainly there to stop crawlers and bots: every page load runs several database queries, which count against Neon's free-tier compute. Rejected requests are stopped in `proxy.ts` before the page or the database is touched.


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
2. Add `DASHBOARD_DATABASE_URL`, `DASHBOARD_PASSWORD`, and `DASHBOARD_DISCORD_TOKEN` as project environment variables. Use the read-only role's **pooled** connection string. Don't use the owner role through the pooler: it would share pgbouncer connections with the bot, and the dashboard's per-connection read-only setting could leak onto them.
3. Set **Ignored Build Step** to `git diff --quiet HEAD^ HEAD -- .` so bot-only commits don't trigger a dashboard build. (Vercel runs it from the root directory, so `.` means `dashboard/`.)

The bot's Fly deploy already ignores this folder: `.dockerignore` excludes it, and the deploy workflow skips pushes that only change `dashboard/`.
