import { query } from './db';
import type { SortOrder, StatusFilter } from './format';

// Every query takes guildId: a guild ID, or null for all servers.
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

export function getPoolProgress(guildId: string | null): Promise<PoolProgress[]> {
  return query<PoolProgress>(
    `WITH ${GUILDS_CTE},
     statuses AS (SELECT n.guild_id, ${LATEST_STATUS} AS status FROM nominations n)
     SELECT g.guild_id,
       (SELECT count(*) FROM statuses s WHERE s.guild_id = g.guild_id)::int AS total,
       (SELECT count(*) FROM statuses s WHERE s.guild_id = g.guild_id AND s.status = 'posted')::int AS posted,
       (SELECT count(*) FROM statuses s WHERE s.guild_id = g.guild_id AND s.status = 'skipped')::int AS skipped,
       (SELECT min(sh.posted_at) FROM schedule_history sh WHERE sh.guild_id = g.guild_id) AS cycle_started
     FROM guilds g
     WHERE $1::text IS NULL OR g.guild_id = $1
     ORDER BY g.guild_id`,
    [guildId],
  );
}

export function getRecentPosts(guildId: string | null, limit = 20): Promise<RecentPost[]> {
  return query<RecentPost>(
    `SELECT sh.guild_id, sh.message_link, sh.posted_at, n.created_at AS nominated_at
     FROM schedule_history sh
     LEFT JOIN nominations n ON n.message_link = sh.message_link
     WHERE ${ROW_STATUS} = 'posted'
       AND ($1::text IS NULL OR sh.guild_id = $1)
     ORDER BY sh.posted_at DESC
     LIMIT $2`,
    [guildId, limit],
  );
}

// Whitelisted ORDER BY clauses; never interpolate user input into SQL.
const ORDER_BY: Record<SortOrder, string> = {
  newest: 'created_at DESC, id DESC',
  oldest: 'created_at ASC, id ASC',
  score: 'net_score DESC, created_at DESC',
};

export function getNominations(opts: {
  guildId: string | null;
  status: StatusFilter;
  sort: SortOrder;
  limit?: number;
}): Promise<NominationRow[]> {
  // vote_value is 1 or -1 for active votes; 0 marks a withdrawn reaction
  // vote, which the FILTERs below naturally exclude.
  return query<NominationRow>(
    `WITH tallied AS (
       SELECT n.id, n.guild_id, n.message_link, n.nominator, n.created_at,
         count(*) FILTER (WHERE v.vote_value = 1)::int AS up_votes,
         count(*) FILTER (WHERE v.vote_value = -1)::int AS down_votes,
         ${LATEST_STATUS} AS history_status
       FROM nominations n
       LEFT JOIN votes v ON v.nomination_id = n.id
       WHERE $1::text IS NULL OR n.guild_id = $1
       GROUP BY n.id
     )
     SELECT *, up_votes - down_votes AS net_score
     FROM tallied
     WHERE NOT ($2::boolean AND history_status IS NOT NULL)
     ORDER BY ${ORDER_BY[opts.sort]}
     LIMIT $3`,
    [opts.guildId, opts.status === 'pool', opts.limit ?? null],
  );
}

export async function getVoteStats(guildId: string | null): Promise<VoteStats> {
  const rows = await query<VoteStats>(
    `SELECT count(*)::int AS total,
       count(DISTINCT v.voter_id)::int AS voters,
       count(*) FILTER (WHERE v.source = 'button')::int AS button,
       count(*) FILTER (WHERE v.source = 'reaction')::int AS reaction
     FROM votes v
     JOIN nominations n ON n.id = v.nomination_id
     WHERE v.vote_value <> 0 AND ($1::text IS NULL OR n.guild_id = $1)`,
    [guildId],
  );
  return rows[0] ?? { total: 0, voters: 0, button: 0, reaction: 0 };
}

export function getGuildSettings(guildId: string | null): Promise<GuildSettings[]> {
  return query<GuildSettings>(
    `SELECT guild_id, random_post_schedule, next_random_post, enable_monthly_recap, nomination_channel
     FROM guild_config
     WHERE $1::text IS NULL OR guild_id = $1
     ORDER BY guild_id`,
    [guildId],
  );
}
