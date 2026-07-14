import * as queries from './queries.js';
import { Client, EmbedBuilder } from 'discord.js';
import { EmbedHelper } from '#shared';
import { getNominationById } from '#nominations';
import type { VoteSource } from './queries.js';

export class VotingService {

  private async refreshTailEmbed(
    client: Client,
    channelId: string,
    nominationId: number
  ): Promise<void> {
    const nomination = await getNominationById(nominationId);

    if (!nomination || !nomination.nomination_message_id) {
      return;
    }

    const channel = client.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) {
      return;
    }

    const message = await channel.messages.fetch(nomination.nomination_message_id);
    if (!message || message.embeds.length === 0) {
      return;
    }

    const voteCounts = await queries.getVoteCountsForNomination(nominationId);
    const tailEmbed = message.embeds[message.embeds.length - 1]; // Tail embed should be the last one

    if (!tailEmbed) {
      console.error('Tail embed not found in the nomination message.');
      return;
    }

    const updatedTailEmbed = EmbedHelper.getUpdatedTailEmbed(
      EmbedBuilder.from(tailEmbed), // Create a mutable EmbedBuilder from the partial embed
      voteCounts.up_votes,
      voteCounts.down_votes
    );

    const updatedEmbeds = message.embeds.map((embed, index) =>
      index === message.embeds.length - 1 ? updatedTailEmbed : embed
    );

    await message.edit({ embeds: updatedEmbeds });
  }

  public async addOrUpdateVote(
    client: Client,
    channelId: string,
    nominationId: number,
    voterId: string,
    voteType: 'up' | 'down',
    source: VoteSource
  ): Promise<queries.VoteResult> {
    const result = await queries.addOrUpdateVote(nominationId, voterId, voteType, source);

    if (result.vote) {
      await this.refreshTailEmbed(client, channelId, nominationId);
    }

    return result;
  }

  public async removeReactionVote(
    client: Client,
    channelId: string,
    nominationId: number,
    voterId: string
  ): Promise<void> {
    const vote = await queries.clearReactionVote(nominationId, voterId);

    if (vote) {
      await this.refreshTailEmbed(client, channelId, nominationId);
    }
  }
}
