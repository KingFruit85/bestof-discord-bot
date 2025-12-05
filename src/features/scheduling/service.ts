import { Client, TextChannel } from 'discord.js';
import {
  addNominationToHistory,
  clearScheduleHistory,
  getRandomUnpostedNomination,
} from './queries.js';
import { EmbedHelper, MessageHelper } from '#shared';
import { getNominationChannel } from '#guild-config';

export class SchedulingService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async postRandomNomination(guildId: string): Promise<void> {
    const nominationChannelId = await getNominationChannel(guildId);
    if (!nominationChannelId) {
      console.log(`No nomination channel configured for guild ${guildId}`);
      return;
    }

    let nomination = await getRandomUnpostedNomination(guildId);

    if (!nomination) {
      // All nominations have been posted, clear history and try again
      await clearScheduleHistory(guildId);
      nomination = await getRandomUnpostedNomination(guildId);
    }

    if (!nomination) {
      console.log(`No nominations to post for guild ${guildId}`);
      return;
    }

    try {
      const channel = await this.client.channels.fetch(nominationChannelId);
      if (channel && channel instanceof TextChannel) {
        const message = await MessageHelper.getMessageFromLink(
          this.client,
          nomination.message_link
        );
        const { embeds, files } = await EmbedHelper.createNominationEmbeds(
          message.author,
          message
        );
        await channel.send({ embeds, files: files ?? [] });
        await addNominationToHistory(guildId, nomination.message_link);
        console.log(`Posted nomination ${nomination.id} to channel ${nominationChannelId}`);
      }
    } catch (error) {
      console.error(`Error posting nomination for guild ${guildId}:`, error);
    }
  }
}