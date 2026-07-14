import { query } from "#config";

export type VoteSource = 'button' | 'reaction';

export type VoteDecision = 'insert' | 'update' | 'ignore';

/**
 * Pure decision logic for first-method-wins voting: a user's vote is
 * "owned" by whichever source (button or reaction) first recorded it.
 * Kept separate from addOrUpdateVote so it can be unit tested without a DB.
 */
export function decideVoteAction(
  existingSource: VoteSource | null,
  incomingSource: VoteSource
): VoteDecision {
  if (!existingSource) return 'insert';
  if (existingSource !== incomingSource) return 'ignore';
  return 'update';
}

export interface Vote {
  id: number;
  nomination_id: number;
  voter_id: string;
  vote_value: number;
  source: VoteSource;
  created_at: Date;
}

/**
 * A vote row with vote_value === 0 is a withdrawn reaction vote (see
 * clearReactionVote) — it's kept for history, but no longer represents an
 * active claim on this nomination. Treating it as null here lets the other
 * method freely claim the vote once it's withdrawn, instead of being
 * permanently locked out by the row's stale `source`.
 */
export function activeSourceOf(vote: Vote | null): VoteSource | null {
  if (!vote || vote.vote_value === 0) return null;
  return vote.source;
}

export interface Votes {
  up_votes: number;
  down_votes: number
}

export interface VoteResult {
  vote: Vote | null;
  /** true only when a different-source vote already owns this user/nomination pair */
  ignored: boolean;
}

export async function getVote(
  nominationId: number,
  voterId: string
): Promise<Vote | null> {
  const result = await query<Vote>(
    'SELECT * FROM votes WHERE nomination_id = $1 AND voter_id = $2',
    [nominationId, voterId]
  );
  return result.rows[0] || null;
}

export async function addOrUpdateVote(
  nominationId: number,
  voterId: string,
  voteType: 'up' | 'down',
  source: VoteSource
): Promise<VoteResult> {
  const voteValue = voteType === 'up' ? 1 : -1;
  const existing = await getVote(nominationId, voterId);
  const decision = decideVoteAction(activeSourceOf(existing), source);

  if (decision === 'ignore') {
    return { vote: null, ignored: true };
  }

  // Only perform the UPDATE if the existing vote value in the table is
  // different from the new vote value. A row with vote_value = 0 (a
  // withdrawn reaction vote) is up for grabs by either method, so it's
  // allowed to reclaim `source` too, not just `vote_value`.
  const result = await query<Vote>(
    `INSERT INTO votes (nomination_id, voter_id, vote_value, source)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (nomination_id, voter_id) DO UPDATE
         SET vote_value = EXCLUDED.vote_value,
             source = EXCLUDED.source
         WHERE votes.vote_value IS DISTINCT FROM EXCLUDED.vote_value
           AND (votes.vote_value = 0 OR votes.source = EXCLUDED.source)
         RETURNING *`,
    [nominationId, voterId, voteValue, source]
  );

  return { vote: result.rows[0] || null, ignored: false };
}

/**
 * Zeroes out a reaction-sourced vote when the user removes their 🏆
 * reaction. No-ops if the user has no vote, or their vote is
 * button-sourced (first-method-wins) — in the button case the row's
 * `source` won't match, so the WHERE clause simply matches nothing.
 */
export async function clearReactionVote(
  nominationId: number,
  voterId: string
): Promise<Vote | null> {
  const result = await query<Vote>(
    `UPDATE votes SET vote_value = 0
     WHERE nomination_id = $1 AND voter_id = $2 AND source = 'reaction'
     RETURNING *`,
    [nominationId, voterId]
  );
  return result.rows[0] || null;
}

export async function getVoteCountsForNomination(
  nominationId: number
): Promise<Votes> {
  const result = await query<Votes>(
    `SELECT
        COALESCE(COUNT(v.id) FILTER (WHERE v.vote_value = 1), 0)::int as up_votes,
        COALESCE(COUNT(v.id) FILTER (WHERE v.vote_value = -1), 0)::int as down_votes
     FROM votes v
     WHERE v.nomination_id = $1`,
    [nominationId]
  );

  return result.rows[0] || { up_votes: 0, down_votes: 0 };
}