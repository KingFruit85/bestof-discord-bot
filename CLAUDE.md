# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A Discord bot (TypeScript, discord.js v14, Node.js ESM) that lets server members nominate messages for a "best-of" collection. Nominations are voted on with reactions, randomly reposted to a configured channel on a schedule, and can be summarized in an opt-in monthly recap. Persistence is PostgreSQL via `pg`. Deployed to Fly.io (see `Dockerfile` / `fly.toml`).

## Commands

```bash
npm run dev          # tsx watch src/index.ts — run bot with live reload
npm run build         # tsc -> dist/
npm run start         # node dist/index.js — run built bot (production)
npm run type-check    # tsc --noEmit
npm test              # node --import tsx --test "test/**/*.test.ts"
npm run register       # tsx src/register-commands.ts — push slash/context-menu commands to Discord
npm run init-db        # tsx src/config/init-db.ts — apply src/config/schema.sql
```

Run a single test file directly (the `test` script's glob is just a convenience wrapper):
```bash
node --import tsx --test test/picker.test.ts
```

Required env vars (`.env`, loaded via `dotenv`): `DISCORD_TOKEN`, `CLIENT_ID`, `DATABASE_URL`, `PUBLIC_KEY`. After schema changes, re-run `npm run init-db` (the script is idempotent — `schema.sql` is all `CREATE TABLE IF NOT EXISTS`). After adding/changing a slash or context-menu command definition, re-run `npm run register`.

## Architecture

### Feature-sliced modules with subpath imports

Code is organized by feature under `src/features/{nominations,voting,scheduling,guild_config}/`, plus `src/config/` (DB pool + schema) and `src/shared/` (cross-feature helpers). Each feature has an `index.ts` that re-exports its public surface, and cross-feature imports **always** go through subpath import aliases defined in both `package.json`’s `imports` field and `tsconfig.json`’s `paths` — never via relative paths across feature boundaries:

- `#config` → `src/config/index.ts` (DB pool, `query()`, init/close/test helpers)
- `#shared` → `src/shared/index.ts` (`EmbedHelper`, `GreetingHelper`, `MessageHelper`)
- `#nominations`, `#voting`, `#scheduling`, `#guild-config` → each feature's `index.ts`

Note the runtime mapping in `package.json` points at `dist/...js` (compiled output), while `tsconfig.json` points at `src/...ts` for type-checking — `npm run dev` uses `tsx` which resolves TS directly, but `npm start` requires `npm run build` to have produced `dist/` first.

Within a feature, the typical file split is:
- `queries.ts` — raw SQL via `query()` from `#config`, plus the row-shaped TypeScript interfaces
- `service.ts` — business logic composed from queries (and possibly other features)
- `handlers.ts` — discord.js interaction handlers (slash commands, buttons, select menus) that call into services
- `commands.ts` — `SlashCommandBuilder`/`ContextMenuCommandBuilder` definitions (registered via `register-commands.ts`)

Some features omit files that don't apply (e.g. `voting` has no `handlers.ts`/`commands.ts` since it's only triggered by nomination-embed buttons; `guild_config` has an empty `service.ts` since its logic lives directly in `handlers.ts`/`database.ts`).

### Interaction flow

`src/index.ts` is a single `discord.js` `Client` with one central `Events.InteractionCreate` listener that dispatches by interaction type/customId to feature handlers — there is no generic command router. When adding a new command or component, wire it into this switch/if-chain in `index.ts` and add its `customId` constant to the relevant feature's `handlers.ts` (see `NOMINATION_CHANNEL_SELECT_ID` etc. in `guild_config/handlers.ts` for the pattern). Button custom IDs encode state as `action_subaction_id` (e.g. `vote_up_42`) and are parsed by splitting on `_`.

`index.ts` also starts a bare `http` server on `PORT` (default 3000) purely to satisfy Fly.io's health check — it serves no application traffic.

### Scheduling

`Scheduler` (`features/scheduling/scheduler.ts`) polls every 5 minutes but only executes work between 08:00–10:00 server time, checking `guild_config.next_random_post` against `NOW()` (`getDueGuilds` in `scheduling/queries.ts`) for random posts, and the 1st-of-month for recaps (deduped via an in-memory `lastRecapCheck` timestamp — this resets on process restart, so a restart on the 1st can cause a duplicate recap post).

Random-post selection is decoupled from Discord I/O via `pickPostableNomination` (`scheduling/picker.ts`), a dependency-injected picker: it pulls a random not-yet-posted nomination, tries to fetch the underlying Discord message, and if the message is gone (deleted), records it in `schedule_history` so it's excluded going forward and retries with the next candidate (up to `maxAttempts`, default 10). `schedule_history` doubles as both "already posted" and "unpostable" tracking, and is fully cleared once the candidate pool is exhausted so the rotation can start over. This indirection is what makes `picker.ts` unit-testable without a live Discord client (see `test/picker.test.ts` for the faking pattern).

### Embeds

`EmbedHelper.createNominationEmbeds` (`shared/embeds.ts`) builds a **fixed 2-3 embed array**: an optional leading embed for the message being replied to (if the nomination is a reply), the nominated message itself, and a tail embed with vote counts + jump link that **must always be last** — `VotingService.addOrUpdateVote` (`voting/service.ts`) and `SchedulingService` rely on positional indexing (`embeds[embeds.length - 1]`) to find and patch the vote-count embed when a vote changes. Keep this ordering invariant if you touch embed construction.

Videos are handled specially: discord.js embeds ignore the `video` field on bot-sent messages, so small video attachments are re-uploaded as files (Discord renders a native player) while large attachments/embedded video links (e.g. YouTube) are returned as plain URLs (`videoUrls`) that callers append to message `content` so Discord unfurls them natively.

### Database

No migration framework — `src/config/schema.sql` is applied idempotently via `npm run init-db`, so schema changes are additive `CREATE TABLE IF NOT EXISTS` / manual `ALTER TABLE` statements you run yourself against the target DB. `query()` (`config/database.ts`) is a thin logging wrapper around a singleton `pg.Pool`; use `getClient()` directly only if you need an explicit transaction.

## Testing

Tests use Node's built-in test runner (`node:test`) with `tsx` for TS support — no Jest/Vitest. Only pure logic is unit-tested (`picker.ts`, `embeds.ts`); anything touching a live `Client` or DB pool is exercised manually. When testing code that takes a discord.js object, prefer faking the minimal shape needed (see `fakeMessage`/`fakeAttachment` in `test/embeds.test.ts`) over instantiating real discord.js classes.
