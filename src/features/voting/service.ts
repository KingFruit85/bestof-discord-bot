import * as queries from './queries.js';
import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { EmbedHelper } from '#shared';
import { getNominationById } from '#nominations';


export class VotingService {

  public async addOrUpdateVote(
    interaction: ButtonInteraction,
    nominationId: number,
    voterId: string,
    voteType: 'up' | 'down'
  ) {
    const result = await queries.addOrUpdateVote(nominationId, voterId, voteType);

    if (result) {
      const nomination = await getNominationById(nominationId);

      if (nomination && nomination.nomination_message_id) {
        const channel = interaction.client.channels.cache.get(interaction.channelId);
        if (channel && channel.isTextBased()) {
          const message = await channel.messages.fetch(nomination.nomination_message_id);

          if (message && message.embeds.length > 0) {
            const voteCounts = await queries.getVoteCountsForNomination(nominationId);
            const tailEmbed = message.embeds[message.embeds.length - 1]; // Tail embed should be the last one

            if (!tailEmbed) {
              console.error('Tail embed not found in the nomination message.');
              return result;
            }

            const updatedTailEmbed = EmbedHelper.getUpdatedTailEmbed(
              EmbedBuilder.from(tailEmbed), // Create a mutable EmbedBuilder from the partial embed
              voteCounts.up_votes,
              voteCounts.down_votes
            );

            const updatedEmbeds = message.embeds.map((embed, index) => {
              if (index === message.embeds.length - 1) {
                return updatedTailEmbed;
              }
              return embed;
            });

            await message.edit({ embeds: updatedEmbeds });
          }
        }
      }
    }

    return result;
  }
}