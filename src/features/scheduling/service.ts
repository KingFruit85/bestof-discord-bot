import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import {
  addNominationToHistory,
  clearScheduleHistory,
  getRandomUnpostedNomination,
  getNominationsFromPreviousMonth,
} from './queries.js';
import { EmbedHelper, GreetingHelper, MessageHelper } from '#shared';
import { getGuildConfig, getNominationChannel } from '#guild-config';

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
        await channel.send({ content: GreetingHelper.randomNominationMessage(message.author), embeds, files: files ?? [] });
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