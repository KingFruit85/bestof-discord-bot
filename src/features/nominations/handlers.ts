import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageContextMenuCommandInteraction, MessageFlags, TextChannel } from 'discord.js';
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
  const chrisUserId = '317070992339894273'

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

  if (message.author.id === nominator && message.author.id != chrisUserId) {
    await interaction.reply({
      content: GreetingHelper.userNominatingOwnMessage(interaction.user),
    });
    return;
  }


  try {
    await interaction.deferReply({ ephemeral: true });
    const result = await nominationService.addNomination(
      guildId,
      messageLink,
      nominator
    );

    if (result.success && result.nomination) {

      // create the embedded reply that'll be posted to the channel the comment
      // was nominated from

      let { embeds, files } = await EmbedHelper.createNominationEmbeds(
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

      // Cross post to nomination channel as long as the interaction origin isn't the nomination channel
      const guildConfig = await getGuildConfig(guildId);

      if (guildConfig?.allow_crossposts && guildConfig.nomination_channel) {
        try {
          const nominationChannel = await interaction.client.channels.fetch(guildConfig.nomination_channel);

          // This should prevent double posting in the nomination channel
          const interactionOriginChannelIsNominationChannel = interaction.channel?.id === nominationChannel?.id;
          
          let embedsWithoutVoteCounter = embeds.slice(0, -1);

          const tail = new EmbedBuilder()
            .addFields(
              {
                name: "🔗 Message Link",
                value: `[Jump to message](${message.url})`
              }
            )

          embedsWithoutVoteCounter.push(tail);

          if (nominationChannel && nominationChannel instanceof TextChannel && !interactionOriginChannelIsNominationChannel) {
            await nominationChannel.send({
              content: GreetingHelper.crosspostGreeting(interaction.channel as TextChannel, interaction.user, interaction.targetMessage),
              embeds: embedsWithoutVoteCounter,
              files: files ?? [],
            });
          }
        } catch (error) {
          console.error(`Error crossposting nomination for guild ${guildId}:`, error);
          // Do not send error to user, just log it
        }
      }

      // Reply to origin channel
      const replyMessage = await (interaction.channel as TextChannel).send({
        content: GreetingHelper.generalChannelGreeting(interaction.channel as TextChannel, interaction.user, interaction.targetMessage),
        embeds: embeds,
        files: files ?? [],
        components: [row],
      });
      
      await interaction.editReply({ content: 'Nomination submitted!' });

      if (replyMessage && result.nomination.id) {
        await updateNominationMessageId(result.nomination.id, replyMessage.id);
      }
    } else if (result.error === 'ALREADY_NOMINATED') {
      if (result.nomination) {
        await addOrUpdateVote(
          result.nomination.id,
          nominator,
          'up'
        );

        await interaction.editReply({
          content: 'This message has already been nominated! Your vote has been added to the existing nomination if it wasn\'t already.',
        });
      } else {
        await interaction.editReply({
          content: 'This message has already been nominated, but the original nomination could not be retrieved.',
        });

      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    await interaction.editReply({
      content: 'There was an error adding this nomination.',
    });
  }
}