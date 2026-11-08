import { query } from './db';
import type { SortOrder, StatusFilter } from './format';

// Every query takes guildIds: the servers to cover, already stripped of
// hidden ones (see resolveScope in format.ts). Never pass an unfiltered list.
// History is matched on message_link, mirroring getRandomUnpostedNomination
// in the bot's scheduling/queries.ts.

export type HistoryStatus = 'posted' | 'skipped';

export interface PoolProgress {
  guild_id: string;
  total: number;
  posted: number;
  skipped: number;
  cycle_started: Date | null;
}

export interface RecentPost {
  guild_id: string;
  message_link: string;
  posted_at: Date;
  nominated_at: Date | null;
}

export interface NominationRow {
  id: number;
  guild_id: string;
  message_link: string;
  nominator: string;
  /** False for nominations from before NOMINATOR_KNOWN_SINCE; see NOMINATOR_KNOWN. */
  nominator_known: boolean;
  /** Who wrote the nominated message; null if it was deleted before the backfill. */
  author_id: string | null;
  created_at: Date;
  up_votes: number;
  down_votes: number;
  net_score: number;
  /** Latest history status this cycle, or null if still in the pool. */
  history_status: HistoryStatus | null;
}

export interface VoteStats {
  total: number;
  voters: number;
  button: number;
  reaction: number;
}

export interface GuildSettings {
  guild_id: string;
  random_post_schedule: string | null;
  next_random_post: Date | null;
  enable_monthly_recap: boolean | null;
  nomination_channel: string | null;
}

/**
 * When the current bot started recording nominators. Nominations before this
 * were imported from the old bot, and 94% of them have nominator = author:
 * the old data seems to hold the author there, so their real nominator is
 * treated as unknown. (Unconfirmed; drop the filter if that turns out wrong.)
 */
export const NOMINATOR_KNOWN_SINCE = new Date('2025-12-12T00:00:00Z');
const NOMINATOR_KNOWN = `(n.created_at >= '2025-12-12')`;

const GUILDS_CTE = `guilds AS (SELECT guild_id FROM guild_config UNION SELECT guild_id FROM nominations)`;

// schedule_history.status ('posted' | 'skipped') was added by the bot's
// 2026-11-07 migration. Reading it through to_jsonb() yields NULL instead of
// an error when the column doesn't exist yet, so the dashboard works on both
// sides of the migration. Rows from before it read as 'posted', as in the bot.
const ROW_STATUS = `COALESCE(to_jsonb(sh) ->> 'status', 'posted')`;

/** Latest history status for nomination n this cycle, or NULL if still in the pool. */
const LATEST_STATUS = `(SELECT ${ROW_STATUS} FROM schedule_history sh
   WHERE sh.message_link = n.message_link
   ORDER BY sh.posted_at DESC
   LIMIT 1)`;

export async function getGuildIds(): Promise<string[]> {
  const rows = await query<{ guild_id: string }>(`WITH ${GUILDS_CTE} SELECT guild_id FROM guilds ORDER BY guild_id`);
  return rows.map((row) => row.guild_id);
}

export function getPoolProgress(guildIds: readonly string[]): Promise<PoolProgress[]> {
  return query<PoolProgress>(
    `WITH ${GUILDS_CTE},
     statuses AS (SELECT n.guild_id, ${LATEST_STATUS} AS status FROM nominations n)
     SELECT g.guild_id,
       (SELECT count(*) FROM statuses s WHERE s.guild_id = g.guild_id)::int AS total,
       (SELECT count(*) FROM statuses s WHERE s.guild_id = g.guild_id AND s.status = 'posted')::int AS posted,
       (SELECT count(*) FROM statuses s WHERE s.guild_id = g.guild_id AND s.status = 'skipped')::int AS skipped,
       (SELECT min(sh.posted_at) FROM schedule_history sh WHERE sh.guild_id = g.guild_id) AS cycle_started
     FROM guilds g
     WHERE g.guild_id = ANY($1::text[])
     ORDER BY g.guild_id`,
    [guildIds],
  );
}

export function getRecentPosts(guildIds: readonly string[], limit = 20): Promise<RecentPost[]> {
  return query<RecentPost>(
    `SELECT sh.guild_id, sh.message_link, sh.posted_at, n.created_at AS nominated_at
     FROM schedule_history sh
     LEFT JOIN nominations n ON n.message_link = sh.message_link
     WHERE ${ROW_STATUS} = 'posted'
       AND sh.guild_id = ANY($1::text[])
     ORDER BY sh.posted_at DESC
     LIMIT $2`,
    [guildIds, limit],
  );
}

// Whitelisted ORDER BY clauses; never interpolate user input into SQL.
const ORDER_BY: Record<SortOrder, string> = {
  newest: 'created_at DESC, id DESC',
  oldest: 'created_at ASC, id ASC',
  score: 'net_score DESC, created_at DESC',
};

export function getNominations(opts: {
  guildIds: readonly string[];
  status: StatusFilter;
  sort: SortOrder;
  limit?: number;
}): Promise<NominationRow[]> {
  // vote_value is 1 or -1 for active votes; 0 marks a withdrawn reaction
  // vote, which the FILTERs below naturally exclude.
  return query<NominationRow>(
    `WITH tallied AS (
       SELECT n.id, n.guild_id, n.message_link, n.nominator, n.author_id, n.created_at,
         ${NOMINATOR_KNOWN} AS nominator_known,
         count(*) FILTER (WHERE v.vote_value = 1)::int AS up_votes,
         count(*) FILTER (WHERE v.vote_value = -1)::int AS down_votes,
         ${LATEST_STATUS} AS history_status
       FROM nominations n
       LEFT JOIN votes v ON v.nomination_id = n.id
       WHERE n.guild_id = ANY($1::text[])
       GROUP BY n.id
     )
     SELECT *, up_votes - down_votes AS net_score
     FROM tallied
     WHERE NOT ($2::boolean AND history_status IS NOT NULL)
     ORDER BY ${ORDER_BY[opts.sort]}
     LIMIT $3`,
    [opts.guildIds, opts.status === 'pool', opts.limit ?? null],
  );
}

export async function getVoteStats(guildIds: readonly string[]): Promise<VoteStats> {
  const rows = await query<VoteStats>(
    `SELECT count(*)::int AS total,
       count(DISTINCT v.voter_id)::int AS voters,
       count(*) FILTER (WHERE v.source = 'button')::int AS button,
       count(*) FILTER (WHERE v.source = 'reaction')::int AS reaction
     FROM votes v
     JOIN nominations n ON n.id = v.nomination_id
     WHERE v.vote_value <> 0 AND n.guild_id = ANY($1::text[])`,
    [guildIds],
  );
  return rows[0] ?? { total: 0, voters: 0, button: 0, reaction: 0 };
}

export function getGuildSettings(guildIds: readonly string[]): Promise<GuildSettings[]> {
  return query<GuildSettings>(
    `SELECT guild_id, random_post_schedule, next_random_post, enable_monthly_recap, nomination_channel
     FROM guild_config
     WHERE guild_id = ANY($1::text[])
     ORDER BY guild_id`,
    [guildIds],
  );
}

// ---- Leaderboards, hall of fame, activity -------------------------------
//
// Three quirks of the data shape these queries:
// - Nominators automatically upvote their own nomination, so "votes" here
//   means votes from anyone but the nominator or the message's author
//   (OTHERS_VOTE).
// - Nominators are only known since NOMINATOR_KNOWN_SINCE, so nominator-based
//   boards only count nominations from then on.
// - Vote created_at is not real history: votes were imported in Dec 2025.
//   Periods therefore filter on when the *nomination* was made.
//
// Params: $1 guild IDs, $2 period length in days or null (all time),
// $3 row limit.

const IN_GUILD = `n.guild_id = ANY($1::text[])`;
// Timestamps are stored as UTC without a time zone.
const IN_PERIOD = `($2::int IS NULL OR n.created_at >= (now() AT TIME ZONE 'UTC') - make_interval(days => $2::int))`;
const OTHERS_VOTE = `v.vote_value <> 0 AND v.voter_id <> n.nominator AND v.voter_id IS DISTINCT FROM n.author_id`;
const OTHERS_SCORE = `COALESCE(sum(v.vote_value) FILTER (WHERE ${OTHERS_VOTE}), 0)`;

export interface RankedUser {
  user_id: string;
  /** Biggest fans only: who nominated user_id's messages. */
  fan_id?: string;
  /** Competition rank: tied users share a rank. */
  rank: number;
  value: number;
  /** Best taste only: how many nominations the average covers. */
  nominations?: number;
}

export interface HallOfFameRow {
  id: number;
  guild_id: string;
  message_link: string;
  nominator: string;
  nominator_known: boolean;
  author_id: string | null;
  created_at: Date;
  /** Net votes from everyone except the nominator and the author. */
  score: number;
  rank: number;
}

/** Nominations needed to appear on the best-taste board. */
export const MIN_TASTE_NOMINATIONS = 5;

export function getTopNominators(guildIds: readonly string[], days: number | null, limit = 10): Promise<RankedUser[]> {
  return query<RankedUser>(
    `SELECT n.nominator AS user_id, count(*)::int AS value,
       rank() OVER (ORDER BY count(*) DESC)::int AS rank
     FROM nominations n
     WHERE ${IN_GUILD} AND ${IN_PERIOD} AND ${NOMINATOR_KNOWN}
     GROUP BY n.nominator
     ORDER BY value DESC, user_id
     LIMIT $3`,
    [guildIds, days, limit],
  );
}

export function getTopVoters(guildIds: readonly string[], days: number | null, limit = 10): Promise<RankedUser[]> {
  return query<RankedUser>(
    `SELECT v.voter_id AS user_id, count(*)::int AS value,
       rank() OVER (ORDER BY count(*) DESC)::int AS rank
     FROM votes v
     JOIN nominations n ON n.id = v.nomination_id
     WHERE ${IN_GUILD} AND ${IN_PERIOD} AND ${OTHERS_VOTE}
     GROUP BY v.voter_id
     ORDER BY value DESC, user_id
     LIMIT $3`,
    [guildIds, days, limit],
  );
}

export function getBestTaste(
  guildIds: readonly string[],
  days: number | null,
  limit = 10,
  minNominations = MIN_TASTE_NOMINATIONS,
): Promise<RankedUser[]> {
  return query<RankedUser>(
    `WITH scored AS (
       SELECT n.nominator, ${OTHERS_SCORE} AS score
       FROM nominations n
       LEFT JOIN votes v ON v.nomination_id = n.id
       WHERE ${IN_GUILD} AND ${IN_PERIOD} AND ${NOMINATOR_KNOWN}
       GROUP BY n.id
     )
     SELECT nominator AS user_id, round(avg(score), 1)::float8 AS value, count(*)::int AS nominations,
       rank() OVER (ORDER BY round(avg(score), 1) DESC)::int AS rank
     FROM scored
     GROUP BY nominator
     HAVING count(*) >= $4
     ORDER BY value DESC, nominations DESC, user_id
     LIMIT $3`,
    [guildIds, days, limit, minNominations],
  );
}

export function getHallOfFame(guildIds: readonly string[], days: number | null, limit = 10): Promise<HallOfFameRow[]> {
  return query<HallOfFameRow>(
    `SELECT n.id, n.guild_id, n.message_link, n.nominator, n.author_id, n.created_at,
       ${NOMINATOR_KNOWN} AS nominator_known,
       ${OTHERS_SCORE}::int AS score,
       rank() OVER (ORDER BY ${OTHERS_SCORE} DESC)::int AS rank
     FROM nominations n
     LEFT JOIN votes v ON v.nomination_id = n.id
     WHERE ${IN_GUILD} AND ${IN_PERIOD}
     GROUP BY n.id
     ORDER BY score DESC, n.created_at DESC
     LIMIT $3`,
    [guildIds, days, limit],
  );
}

/** Whose messages get nominated most. Uses all history: authors were backfilled from Discord. */
export function getMostNominated(guildIds: readonly string[], days: number | null, limit = 10): Promise<RankedUser[]> {
  return query<RankedUser>(
    `SELECT n.author_id AS user_id, count(*)::int AS value,
       rank() OVER (ORDER BY count(*) DESC)::int AS rank
     FROM nominations n
     WHERE ${IN_GUILD} AND ${IN_PERIOD} AND n.author_id IS NOT NULL
     GROUP BY n.author_id
     ORDER BY value DESC, user_id
     LIMIT $3`,
    [guildIds, days, limit],
  );
}

/** Who keeps nominating whose messages: (nominator, author) pairs seen at least twice. */
export function getBiggestFans(guildIds: readonly string[], days: number | null, limit = 10): Promise<RankedUser[]> {
  return query<RankedUser>(
    `SELECT n.nominator AS fan_id, n.author_id AS user_id, count(*)::int AS value,
       rank() OVER (ORDER BY count(*) DESC)::int AS rank
     FROM nominations n
     WHERE ${IN_GUILD} AND ${IN_PERIOD} AND ${NOMINATOR_KNOWN}
       AND n.author_id IS NOT NULL AND n.author_id <> n.nominator
     GROUP BY n.nominator, n.author_id
     HAVING count(*) >= 2
     ORDER BY value DESC, fan_id, user_id
     LIMIT $3`,
    [guildIds, days, limit],
  );
}

/** Nominations per calendar month (UTC), oldest first; months with none are absent. */
export function getMonthlyNominations(guildIds: readonly string[]): Promise<{ month: string; count: number }[]> {
  return query<{ month: string; count: number }>(
    `SELECT to_char(date_trunc('month', n.created_at), 'YYYY-MM') AS month, count(*)::int AS count
     FROM nominations n
     WHERE ${IN_GUILD}
     GROUP BY 1
     ORDER BY 1`,
    [guildIds],
  );
}
