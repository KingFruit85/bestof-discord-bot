import { query } from '../../config/database.js';

export interface Nomination {
  id: number;
  guild_id: string;
  message_link: string;
  nominator: string;
  created_at: Date;
}

export interface NominationWithVotes extends Nomination {
  total_score: number;
  vote_count: number;
  up_votes: number;
  down_votes: number;
}

/**
 * Add a new nomination
 */
export async function insertNomination(
  guildId: string,
  messageLink: string,
  nominator: string
): Promise<Nomination> {
  const result = await query<Nomination>(
    `INSERT INTO nominations (guild_id, message_link, nominator) 
     VALUES ($1, $2, $3) 
     RETURNING *`,
    [guildId, messageLink, nominator]
  );

  if (result.rows.length === 0 || result.rows[0] == undefined) {
    throw new Error('Failed to insert nomination');
  }
  
  return result.rows[0];
}

/**
 * Get a nomination by message link
 */
export async function getNominationByLink(
  messageLink: string
): Promise<Nomination | null> {
  const result = await query<Nomination>(
    'SELECT * FROM nominations WHERE message_link = $1',
    [messageLink]
  );
  
  return result.rows[0] || null;
}

/**
 * Get all nominations for a guild with vote counts
 */
export async function getNominationsWithVotes(
  guildId: string,
  startDate?: Date,
  endDate?: Date
): Promise<NominationWithVotes[]> {
  let queryText = `
    SELECT 
      n.*,
      COALESCE(SUM(v.vote_value), 0)::int as total_score,
      COALESCE(COUNT(v.id), 0)::int as vote_count,
      COALESCE(COUNT(v.id) FILTER (WHERE v.vote_value = 1), 0)::int as up_votes,
      COALESCE(COUNT(v.id) FILTER (WHERE v.vote_value = -1), 0)::int as down_votes
    FROM nominations n
    LEFT JOIN votes v ON n.id = v.nomination_id
    WHERE n.guild_id = $1
  `;
  
  const params: any[] = [guildId];
  
  if (startDate) {
    params.push(startDate);
    queryText += ` AND n.created_at >= $${params.length}`;
  }
  
  if (endDate) {
    params.push(endDate);
    queryText += ` AND n.created_at <= $${params.length}`;
  }
  
  queryText += ' GROUP BY n.id ORDER BY total_score DESC, n.created_at DESC';
  
  const result = await query<NominationWithVotes>(queryText, params);
  return result.rows;
}

/**
 * Get a random nomination that hasn't been posted in schedule history
 */
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

/**
 * Delete a nomination
 */
export async function deleteNomination(id: number): Promise<void> {
  await query('DELETE FROM nominations WHERE id = $1', [id]);
}