import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
} from 'discord.js';
import { getGuildConfig, upsertGuildConfig } from './database.js';

export const NOMINATION_CHANNEL_SELECT_ID = 'nomination_channel_select';
export const RANDOM_POST_SCHEDULE_SELECT_ID = 'random_post_schedule_select';
export const ALLOW_CROSSPOSTS_SELECT_ID = 'allow_crossposts_select';
export const ENABLE_MONTHLY_RECAP_SELECT_ID = 'enable_monthly_recap_select';

export async function handleConfigureBotCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used in a guild.',
      ephemeral: true,
    });
    return;
  }

  const guildConfig = await getGuildConfig(interaction.guildId);

  const nominationChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(NOMINATION_CHANNEL_SELECT_ID)
    .setPlaceholder('Select a nomination channel')
    .addChannelTypes(ChannelType.GuildText);

  if (guildConfig?.nomination_channel) {
    nominationChannelSelect.setDefaultChannels([guildConfig.nomination_channel]);
  }

  const randomPostScheduleSelect = new StringSelectMenuBuilder()
    .setCustomId(RANDOM_POST_SCHEDULE_SELECT_ID)
    .setPlaceholder('Select a random post schedule')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Daily')
        .setValue('daily'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Weekly')
        .setValue('weekly')
    );

  if (guildConfig?.random_post_schedule) {
    randomPostScheduleSelect.setPlaceholder(guildConfig.random_post_schedule);
  }

  const allowCrosspostsSelect = new StringSelectMenuBuilder()
    .setCustomId(ALLOW_CROSSPOSTS_SELECT_ID)
    .setPlaceholder('Allow crossposts?')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('True').setValue('true'),
      new StringSelectMenuOptionBuilder().setLabel('False').setValue('false')
    );

  if (guildConfig?.allow_crossposts !== undefined) {
    allowCrosspostsSelect.setPlaceholder(guildConfig.allow_crossposts ? 'true' : 'false');
  }

  const enableMonthlyRecapSelect = new StringSelectMenuBuilder()
    .setCustomId(ENABLE_MONTHLY_RECAP_SELECT_ID)
    .setPlaceholder('Enable monthly recap?')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('True').setValue('true'),
      new StringSelectMenuOptionBuilder().setLabel('False').setValue('false')
    );

  if (guildConfig?.enable_monthly_recap !== undefined) {
    enableMonthlyRecapSelect.setPlaceholder(guildConfig.enable_monthly_recap ? 'true' : 'false');
  }

  const rows = [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(nominationChannelSelect),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(randomPostScheduleSelect),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(allowCrosspostsSelect),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(enableMonthlyRecapSelect),
  ];

  await interaction.reply({
    content: `
      **Guild Configuration**

      **Nomination Channel**
      Select the channel where nominations will be sent.

      **Random Post Schedule**
      Select how often random nominations should be posted.

      **Allow Crossposts**
      Allow nominations from other channels to be crossposted to the nomination channel.

      **Enable Monthly Recap**
      Enable a monthly recap of the top nominations.
    `,
    components: rows,
    ephemeral: true,
  });
}

export async function handleNominationChannelChange(interaction: ChannelSelectMenuInteraction): Promise<void> {
  if (!interaction.guildId) return;
  const channelId = interaction.values[0];
  if (!channelId) return; // TODO: should handle this case properly
  await upsertGuildConfig(interaction.guildId, { nomination_channel: channelId });
  await interaction.reply({ content: `Nomination channel updated to <#${channelId}>.`, ephemeral: true });
}

export async function handleRandomPostScheduleChange(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.guildId) return;
  const schedule = interaction.values[0];
  if (!schedule) return; // TODO: should handle this case properly
  await upsertGuildConfig(interaction.guildId, { random_post_schedule: schedule });
  await interaction.reply({ content: `Random post schedule updated to: ${schedule}.`, ephemeral: true });
}

export async function handleAllowCrosspostsChange(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.guildId) return;
  const allow = interaction.values[0] === 'true';
  await upsertGuildConfig(interaction.guildId, { allow_crossposts: allow });
  await interaction.reply({ content: `Allow crossposts set to: ${allow}.`, ephemeral: true });
}

export async function handleEnableMonthlyRecapChange(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.guildId) return;
  const enable = interaction.values[0] === 'true';
  await upsertGuildConfig(interaction.guildId, { enable_monthly_recap: enable });
  await interaction.reply({ content: `Monthly recap enabled: ${enable}.`, ephemeral: true });
}
