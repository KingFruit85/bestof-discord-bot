# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A Discord bot (TypeScript, discord.js v14, Node.js ESM) that lets server members nominate messages for a "best-of" collection. Nominations are voted on with reactions, randomly reposted to a configured channel on a schedule, and can be summarized in an opt-in monthly recap. Persistence is PostgreSQL via `pg`. Deployed to Fly.io (see `Dockerfile` / `fly.toml`).

`dashboard/` is a separate, read-only Next.js app for inspecting the database (see `dashboard/README.md`). It has its own `package.json` and shares no code with the bot; the bot's `tsconfig.json`, Docker image, and Fly deploy workflow all exclude it.

## Commands

```bash
npm run dev          # tsx watch src/index.ts — run bot with live reload
npm run build         # tsc -> dist/
npm run start         # node dist/index.js — run built bot (production)
npm run type-check    # tsc --noEmit
npm test              # node --import tsx --test "test/**/*.test.ts"
npm run register       # tsx src/register-commands.ts — push slash/context-menu commands to Discord
npm run init-db        # tsx src/config/init-db.ts — apply src/config/schema.sql
npm run backfill-authors  # fill nominations.author_id from Discord (--dry-run to only look up); idempotent
```

Run a single test file directly (the `test` script's glob is just a convenience wrapper):
```bash
node --import tsx --test test/picker.test.ts
```

Pushing to `main` deploys to production immediately via `.github/workflows/fly-deploy.yml` (`flyctl deploy --remote-only`). CI does **not** run tests or type-check, so run `npm test` and `npm run type-check` before pushing to `main`.

Required env vars (`.env`, loaded via `dotenv`): `DISCORD_TOKEN`, `CLIENT_ID`, `DATABASE_URL`, `PUBLIC_KEY`. Each deploy applies `schema.sql` (see Database), so schema changes need no manual step in production. After adding/changing a slash or context-menu command definition, re-run `npm run register`.

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

Some features omit files that don't apply (e.g. `voting` has no `handlers.ts`/`commands.ts` because its entry points live elsewhere: vote buttons are dispatched from `index.ts`, and trophy-reaction votes come through `nominations/handlers.ts`; `guild_config` has an empty `service.ts` since its logic lives directly in `handlers.ts`/`database.ts`).

### Interaction flow

`src/index.ts` is a single `discord.js` `Client` with one central `Events.InteractionCreate` listener that dispatches by interaction type/customId to feature handlers — there is no generic command router. When adding a new command or component, wire it into this switch/if-chain in `index.ts` and add its `customId` constant to the relevant feature's `handlers.ts` (see `NOMINATION_CHANNEL_SELECT_ID` etc. in `guild_config/handlers.ts` for the pattern). Button custom IDs encode state as `action_subaction_id` (e.g. `vote_up_42`) and are parsed by splitting on `_`.

Besides `InteractionCreate`, `index.ts` listens to `MessageReactionAdd`/`MessageReactionRemove` (hence the `Partials.Message/Reaction/User` client config — handlers must `.fetch()` partials first). A 🏆 reaction on any message either creates a nomination or adds a vote (`handleTrophyReactionAdd` in `nominations/handlers.ts`).

**Voting is first-method-wins.** Each vote row records a `source` (`'button'` or `'reaction'`). Whichever source a user votes with first owns that user's vote on that nomination, and votes from the other source are ignored (`decideVoteAction` in `voting/queries.ts`). Removing a trophy reaction sets `vote_value = 0` rather than deleting the row, and `activeSourceOf` treats such rows as unowned so the other method can then claim the vote.

`index.ts` also starts a bare `http` server on `PORT` (default 3000) purely to satisfy Fly.io's health check — it serves no application traffic.

### Scheduling

`Scheduler` (`features/scheduling/scheduler.ts`) polls every 5 minutes but only executes work between 08:00–10:00 server time, checking `guild_config.next_random_post` against `NOW()` (`getDueGuilds` in `scheduling/queries.ts`) for random posts, and the 1st-of-month for recaps (deduped via an in-memory `lastRecapCheck` timestamp — this resets on process restart, so a restart on the 1st can cause a duplicate recap post).

Random-post selection is decoupled from Discord I/O via `pickPostableNomination` (`scheduling/picker.ts`), a dependency-injected picker: it pulls a weighted-random not-yet-posted nomination, tries to fetch the underlying Discord message, and if the message is gone (deleted), records it in `schedule_history` so it's excluded going forward and retries with the next candidate (up to `maxAttempts`, default 10). `schedule_history` records both outcomes via its `status` column (`'posted'` or `'skipped'`). A guild's history is cleared, starting a new cycle, in two cases. The first is before picking, when `shouldStartNewCycle` (`scheduling/cycle.ts`) sees at least `RESET_THRESHOLD` (90%) of postable nominations (total minus skipped) posted. This stops late-cycle pools being dominated by recent nominations. The second, as a fallback, is when the candidate pool is exhausted. Skipped rows are cleared on reset too. `markUnpostable` fires on *any* fetch failure, including transient ones, so skips are deliberately not permanent. The dashboard duplicates `RESET_THRESHOLD` in `dashboard/lib/format.ts`; keep the two in sync.

A nomination joins the pool only when it is `MIN_AGE_DAYS` (30, in `scheduling/cycle.ts`) days old. Younger nominations also do not count toward the 90% threshold. A NULL `created_at` counts as old enough. `getRandomUnpostedNomination` picks one row in SQL, with a chance in proportion to the days the nomination has waited in the pool, plus 1. It uses the Efraimidis–Spirakis key `ORDER BY -LN(1.0 - random()) / weight LIMIT 1`. Do not replace it with `ORDER BY random() * weight`, which is biased. The wait starts at `nominations.waiting_since`. If that is NULL, the wait starts when the nomination reaches the minimum age. `clearScheduleHistory` restarts the wait of every nomination in the old cycle's history, posted or skipped, in the same statement as the delete. It never sets a wait start before the nomination reaches the minimum age. Leftovers keep their wait, so they keep their lead over nominations that join later. Skipped nominations restart so that dead links do not build up weight and use up the picker's attempts. Weighting by message age was rejected because it makes each cycle run from oldest to newest. `schema.sql` seeds `waiting_since` once, when it adds the column. The seed is guarded by a column check so that a re-run of `init-db` does not overwrite values that the bot set. The dashboard duplicates `MIN_AGE_DAYS` in `dashboard/lib/format.ts`; keep the two in sync, and keep the `30 days` in the `schema.sql` seed the same. The weighting is SQL, so no unit test covers it; check changes to it against a real Postgres.

The dependency injection in `pickPostableNomination` is what makes `picker.ts` unit-testable without a live Discord client (see `test/picker.test.ts` for the faking pattern).

### Nomination authors

`nominations.author_id` records who wrote the nominated message, set from `message.author.id` in `createAndPostNomination`. Rows from before 2026-11-08 were filled by `src/scripts/backfill-authors.ts` (the loop itself is `nominations/backfill.ts`, unit-tested); four whose messages were already deleted stay NULL. Nominations imported from the old bot (before 2025-12-12) mostly have `nominator` equal to the author, so their real nominator is treated as unknown by the dashboard (`NOMINATOR_KNOWN_SINCE` in `dashboard/lib/queries.ts`).

### Context messages

The "Add Nomination" context-menu flow first shows an ephemeral select menu (`nominations/context-picker.ts`, wired in `promptForContextMessages`) letting the nominator attach up to `MAX_CONTEXT_SELECTIONS` (3) of the preceding `MAX_CONTEXT_CANDIDATES` (10) messages as context. A `null` return means the 2-minute picker timed out, and the handler must return without nominating. Skipping returns `[]` and proceeds normally. Because the picker calls `deferReply` on the interaction, the rest of the handler uses `editReply`, not `reply`.

Selected messages are stored as links in `nominations.context_message_links` (`TEXT[]`) and **re-fetched from Discord at repost time** (`scheduling/service.ts`) rather than snapshotted, so deleted context messages simply drop out.

Select-option labels are capped by Discord at 100 **UTF-16 code units** (JavaScript `.length`), not code points. `buildContextOptionLabel` truncates by UTF-16 length without splitting surrogate pairs. A code-point-based truncation previously crashed production on emoji-heavy messages, so keep this logic if you touch it.

### Embeds

`EmbedHelper.createNominationEmbeds` (`shared/embeds.ts`) builds an **ordered embed array**: optional leading embeds for the replied-to message and any user-selected context messages, the nominated message itself, and a tail embed with vote counts + jump link that **must always be last** — `VotingService.addOrUpdateVote` (`voting/service.ts`) and `SchedulingService` rely on positional indexing (`embeds[embeds.length - 1]`) to find and patch the vote-count embed when a vote changes. Keep this ordering invariant if you touch embed construction.

Videos are handled specially: discord.js embeds ignore the `video` field on bot-sent messages, so small video attachments are re-uploaded as files (Discord renders a native player) while large attachments/embedded video links (e.g. YouTube) are returned as plain URLs (`videoUrls`) that callers append to message `content` so Discord unfurls them natively.

### Database

No migration framework — `src/config/schema.sql` is applied idempotently via `npm run init-db`. Schema changes go into that file as idempotent statements (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), and every deploy applies them: `fly.toml` runs `node dist/config/init-db.js` as the `release_command`, before the new version starts. If that command fails, the deploy stops before any Machine is updated. `init-db` reads `src/config/schema.sql` from the working directory, so the image must keep `src/`. You can still run `npm run init-db` yourself, for example against a local database.

`init-db.ts` only connects when run as the entry script (an `isMainModule` guard). Importing it must stay side-effect free; `test/init-db-import-safety.test.ts` enforces this. `query()` (`config/database.ts`) is a thin logging wrapper around a singleton `pg.Pool`; use `getClient()` directly only if you need an explicit transaction.

## Testing

Tests use Node's built-in test runner (`node:test`) with `tsx` for TS support — no Jest/Vitest. Only pure logic is unit-tested (the scheduling picker and cycle threshold, embed building, the context picker's label/option builders, and `decideVoteAction`/`activeSourceOf`); anything touching a live `Client` or DB pool is exercised manually. When testing code that takes a discord.js object, prefer faking the minimal shape needed (see `fakeMessage`/`fakeAttachment` in `test/embeds.test.ts`) over instantiating real discord.js classes.
