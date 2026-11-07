import { type Nomination } from '../nominations/queries.js';
import { type GuildConfig } from '#guild-config';
import { query } from '#config';
import { type CycleProgress } from './cycle.js';

export type HistoryStatus = 'posted' | 'skipped';

export interface ScheduleHistory {
  id: number;
  guild_id: string;
  message_link: string;
  posted_at: Date;
  status: HistoryStatus;
}

export async function clearScheduleHistory(guildId: string): Promise<void> {
  await query('DELETE FROM schedule_history WHERE guild_id = $1', [guildId]);
}

export async function addNominationToHistory(
  guildId: string,
  messageLink: string,
  status: HistoryStatus = 'posted'
): Promise<ScheduleHistory> {
  const result = await query<ScheduleHistory>(
    'INSERT INTO schedule_history (guild_id, message_link, status) VALUES ($1, $2, $3) RETURNING *',
    [guildId, messageLink, status]
  );

  if (result.rows.length === 0 || result.rows[0] == undefined) {
    throw new Error('Failed to insert into schedule history');
  }

  return result.rows[0];
}

export async function getCycleProgress(guildId: string): Promise<CycleProgress> {
  // History is matched on message_link, like getRandomUnpostedNomination.
  // LATERAL takes one history row per nomination, in case a link was recorded twice.
  const result = await query<CycleProgress>(
    `SELECT count(*)::int AS total,
       count(*) FILTER (WHERE h.status = 'posted')::int AS posted,
       count(*) FILTER (WHERE h.status = 'skipped')::int AS skipped
     FROM nominations n
     LEFT JOIN LATERAL (
       SELECT sh.status FROM schedule_history sh
       WHERE sh.message_link = n.message_link
       ORDER BY sh.posted_at DESC
       LIMIT 1
     ) h ON true
     WHERE n.guild_id = $1`,
    [guildId]
  );
  return result.rows[0] ?? { total: 0, posted: 0, skipped: 0 };
}

export async function getRandomUnpostedNomination(
  guildId: string
): Promise<Nomination | null> {
  const result = await query<Nomination>(
    `SELECT n.*
     FROM nominations n
     LEFT JOIN schedule_history sh ON n.message_link = sh.message_link
     WHERE n.guild_id = $1 AND sh.id IS NULL
     ORDER BY RANDOM()
     LIMIT 1`,
    [guildId]
  );

  return result.rows[0] || null;
}


export async function getDueGuilds(): Promise<GuildConfig[]> {
    const result = await query<GuildConfig>(
        `SELECT *
         FROM guild_config
         WHERE random_post_schedule IS NOT NULL
           AND next_random_post <= NOW()`
    );
    return result.rows;
}

export async function updateNextPostTime(guildId: string, nextPostTime: Date): Promise<void> {
    await query(
        'UPDATE guild_config SET next_random_post = $1 WHERE guild_id = $2',
        [nextPostTime, guildId]
    );
}

export async function getNominationsFromPreviousMonth(guildId: string): Promise<Nomination[]> {
    const result = await query<Nomination>(
        `SELECT *
         FROM nominations
         WHERE guild_id = $1
           AND created_at >= date_trunc('month', current_date - interval '1 month')
           AND created_at < date_trunc('month', current_date)`,
        [guildId]
    );
    return result.rows;
}

export async function getRecapEnabledGuilds(): Promise<GuildConfig[]> {
    const result = await query<GuildConfig>(
        `SELECT *
         FROM guild_config
         WHERE enable_monthly_recap = true`
    );
    return result.rows;
}
