import * as queries from './queries.js';

export class VotingService {

  public async addOrUpdateVote(
    nominationId: number,
    voterId: string,
    voteType: 'up' | 'down'
  ) {
    const result = await queries.addOrUpdateVote(nominationId, voterId, voteType);

    return result;
  }
}