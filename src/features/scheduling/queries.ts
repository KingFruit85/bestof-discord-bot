import { query } from '../../config/database.js';
import { type Nomination } from '../nominations/queries.js';

export interface ScheduleHistory {
  id: number;
  guild_id: string;
  message_link: string;
  posted_at: Date;
}

export async function clearScheduleHistory(guildId: string): Promise<void> {
  await query('DELETE FROM schedule_history WHERE guild_id = $1', [guildId]);
}

export async function addNominationToHistory(
  guildId: string,
  messageLink: string
): Promise<ScheduleHistory> {
  const result = await query<ScheduleHistory>(
    'INSERT INTO schedule_history (guild_id, message_link) VALUES ($1, $2) RETURNING *',
    [guildId, messageLink]
  );

  if (result.rows.length === 0 || result.rows[0] == undefined) {
    throw new Error('Failed to insert into schedule history');
  }

  return result.rows[0];
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
