import * as queries from './queries.js';
import { type Nomination } from './queries.js';

export interface AddNominationResult { 
  success: boolean; 
  nomination?: Nomination; 
  error?: string 
}

export class NominationService {
  /**
   * Add a new nomination
   * Returns existing nomination if already nominated
   * Throws error if existing nomination cannot be retrieved or on other failures
   */
  async addNomination(
    guildId: string,
    messageLink: string,
    nominator: string
  ): Promise<AddNominationResult> {
    try {
      const nomination = await queries.insertNomination(
        guildId,
        messageLink,
        nominator
      );

      return {
        success: true,
        nomination
      };
    } catch (error: any) {
      // PostgreSQL unique constraint violation
      if (error.code === '23505') {
        const existingNomination = await queries.getNominationByLink(messageLink);
        if (!existingNomination) {
          throw new Error('Failed to retrieve existing nomination after unique constraint violation');
        }
        return {
          success: false,
          error: 'ALREADY_NOMINATED',
          nomination: existingNomination
        };
      }
      throw error;
    }
  }

  /**
   * Get nomination details with vote count
   */
  async getNominationByLink(messageLink: string) {
    return await queries.getNominationByLink(messageLink);
  }

  /**
   * Get all nominations for a guild
   */
  async getGuildNominations(
    guildId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    return await queries.getNominationsWithVotes(guildId, startDate, endDate);
  }

  /**
   * Get a random nomination for posting
   */
  async getRandomNomination(guildId: string) {
    return await queries.getRandomUnpostedNomination(guildId);
  }
}