import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageContextMenuCommandInteraction, MessageFlags, TextChannel } from 'discord.js';
import { EmbedHelper, GreetingHelper, MessageHelper } from '#shared';
import { addOrUpdateVote } from '#voting';
import { updateNominationMessageId, type NominationService } from '#nominations';
import { getGuildConfig } from '#guild-config';

export async function handleAddNomination(
  interaction: MessageContextMenuCommandInteraction,
  nominationService: NominationService,
) {
  const messageLink = interaction.targetMessage.url;
  const nominator = interaction.user.id;
  const guildId = interaction.guildId!;

  // this is the nominated message
  const message = await MessageHelper.getMessageFromLink(interaction.client, messageLink);

  // Validate message
  if (!message) {
    await interaction.reply({
      content: 'Could not find the message to nominate. It may have been deleted.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  // early return if the message author is a bot or trying to nominate themselves
  if (message.author.bot) {
    await interaction.reply({
      content: 'You cannot nominate messages from bots.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (message.author.id === nominator) {
    await interaction.reply({
      content: GreetingHelper.userNominatingOwnMessage(interaction.user),
    });
    return;
  }


  try {
    const result = await nominationService.addNomination(
      guildId,
      messageLink,
      nominator
    );

    if (result.success && result.nomination) {

      // create the embedded reply that'll be posted to the channel the comment
      // was nominated from

      const { embeds, files } = await EmbedHelper.createNominationEmbeds(
        interaction.user,
        message,
      );

      // Add users vote to the nomination
      await addOrUpdateVote(
        result.nomination.id,
        nominator,
        'up'
      );

      const voteUpButton = new ButtonBuilder()
        .setCustomId(`vote_up_${result.nomination.id}`)
        .setLabel('🔥')
        .setStyle(ButtonStyle.Success);
      const voteDownButton = new ButtonBuilder()
        .setCustomId(`vote_down_${result.nomination.id}`)
        .setLabel('💩')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(voteUpButton, voteDownButton);

      // Crossposting logic
      const guildConfig = await getGuildConfig(guildId);
      if (guildConfig?.allow_crossposts && guildConfig.nomination_channel) {
        try {
          const nominationChannel = await interaction.client.channels.fetch(guildConfig.nomination_channel);
          if (nominationChannel && nominationChannel instanceof TextChannel) {
            await nominationChannel.send({
              content: GreetingHelper.crosspostGreeting(interaction.channel as TextChannel, interaction.user, interaction.targetMessage),
              embeds: embeds, //TODO: Remove the trail embedh
              files: files ?? [],
              components: [row],
            });
          }
        } catch (error) {
          console.error(`Error crossposting nomination for guild ${guildId}:`, error);
          // Do not send error to user, just log it
        }
      }

      const replyMessage = await interaction.reply({
        content: GreetingHelper.generalChannelGreeting(interaction.channel as TextChannel, interaction.user, interaction.targetMessage),
        embeds: embeds,
        files: files ?? [],
        components: [row],
        withResponse: true,
      });

      if (replyMessage && result.nomination.id) {
        await updateNominationMessageId(result.nomination.id, replyMessage.resource?.message?.id as string);
      }
    } else if (result.error === 'ALREADY_NOMINATED') {
      if (result.nomination) {
        await addOrUpdateVote(
          result.nomination.id,
          nominator,
          'up'
        );

        await interaction.reply({
          content: 'This message has already been nominated! Your vote has been added to the existing nomination if it wasn\'t already.',
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply({
          content: 'This message has already been nominated, but the original nomination could not be retrieved.',
          flags: MessageFlags.Ephemeral
        });

      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    await interaction.reply({
      content: 'There was an error adding this nomination.',
      flags: MessageFlags.Ephemeral
    });
  }
}