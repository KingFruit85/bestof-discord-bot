import { query } from "#config";

export interface Vote {
    id: number;
    nomination_id: number;
    voter_id: string;
    vote_value: number;
    created_at: Date;
}

export async function addOrUpdateVote(
    nominationId: number,
    voterId: string,
    voteType: 'up' | 'down'
): Promise<Vote | null> {
    const voteValue = voteType === 'up' ? 1 : -1;


    // Only perform the UPDATE if the existing vote value in 
    // the table is different from the new vote value
    const result = await query<Vote>(
        `INSERT INTO votes (nomination_id, voter_id, vote_value)
         VALUES ($1, $2, $3)
         ON CONFLICT (nomination_id, voter_id) DO UPDATE
         SET vote_value = EXCLUDED.vote_value
         WHERE votes.vote_value IS DISTINCT FROM EXCLUDED.vote_value
         RETURNING *`,
        [nominationId, voterId, voteValue]
    );

    return result.rows[0] || null;

}