import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import {
  addNominationToHistory,
  clearScheduleHistory,
  getRandomUnpostedNomination,
  getNominationsFromPreviousMonth,
} from './queries.js';
import { pickPostableNomination } from './picker.js';
import { EmbedHelper, GreetingHelper, MessageHelper } from '#shared';
import { getGuildConfig, getNominationChannel } from '#guild-config';
import { getVoteCountsForNomination } from '#voting';

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

    // Nominations whose original message is gone are recorded in history so
    // they stop being picked, and another candidate is tried immediately.
    const picked = await pickPostableNomination({
      getCandidate: () => getRandomUnpostedNomination(guildId),
      resetHistory: () => clearScheduleHistory(guildId),
      fetchMessage: (link) => MessageHelper.getMessageFromLink(this.client, link),
      markUnpostable: async (link) => {
        console.log(
          `Nomination message ${link} could not be fetched (likely deleted); excluding it from future scheduled posts.`
        );
        await addNominationToHistory(guildId, link);
      },
    });

    if (!picked) {
      console.log(`No postable nominations for guild ${guildId}`);
      return;
    }

    const { nomination, message } = picked;

    // get nomination votes
    const votecounts = await getVoteCountsForNomination(nomination.id);

    try {
      const channel = await this.client.channels.fetch(nominationChannelId);
      if (channel && channel instanceof TextChannel) {
        const { embeds, files, mediaUrls } = await EmbedHelper.createNominationEmbeds(
          message,
          votecounts
        );
        const content = [
          GreetingHelper.randomNominationMessage(message.author),
          ...mediaUrls,
        ].join('\n');
        await channel.send({ content, embeds, files: files ?? [] });
        await addNominationToHistory(guildId, nomination.message_link);
        console.log(`Posted nomination ${nomination.id} to channel ${nominationChannelId}`);
      }
    } catch (error) {
      console.error(`Error posting nomination for guild ${guildId}:`, error);
    }
  }

  async postMonthlyRecap(guildId: string): Promise<void> {
    const guildConfig = await getGuildConfig(guildId);
    if (!guildConfig?.enable_monthly_recap) {
      return;
    }

    const nominationChannelId = guildConfig.nomination_channel;
    if (!nominationChannelId) {
      console.log(`No nomination channel configured for guild ${guildId} for monthly recap.`);
      return;
    }

    const nominations = await getNominationsFromPreviousMonth(guildId);

    if (nominations.length === 0) {
      console.log(`No nominations from last month to post for guild ${guildId}.`);
      return;
    }

    const recapEmbed = new EmbedBuilder()
      .setTitle('🏆 Monthly Recap')
      .setColor(0x0099FF)
      .setTimestamp();

    let description = 'Here are the nominations from the past month:\n\n';
    for (const nomination of nominations) {
      description += `- Nominated by <@${nomination.nominator}>: [View Nomination](${nomination.message_link})\n`;
    }
    recapEmbed.setDescription(description);

    try {
      const channel = await this.client.channels.fetch(nominationChannelId);
      if (channel && channel instanceof TextChannel) {
        await channel.send({ content: GreetingHelper.monthlyRecapMessage(), embeds: [recapEmbed] });
        console.log(`Posted monthly recap for guild ${guildId}`);
      }
    } catch (error) {
      console.error(`Error posting monthly recap for guild ${guildId}:`, error);
    }
  }
}