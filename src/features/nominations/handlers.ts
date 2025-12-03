import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageContextMenuCommandInteraction, MessageFlags } from 'discord.js';
import { EmbedHelper, MessageHelper } from '#shared';
import type { VotingService } from '#voting';
import type { NominationService } from '#nominations';

export async function handleAddNomination(
  interaction: MessageContextMenuCommandInteraction,
  nominationService: NominationService,
  votingService: VotingService
) {
  const messageLink = interaction.targetMessage.url;
  const nominator = interaction.user.id;
  const guildId = interaction.guildId!;

  try {
    const result = await nominationService.addNomination(
      guildId,
      messageLink,
      nominator
    );

    if (result.success && result.nomination) {

      // get the nominated message to include in the reply
      const message = await MessageHelper.getMessageFromLink(interaction.client, messageLink);

      // create the embedded reply that'll be posted to the channel the comment
      // was nominated from

      const { embeds, files } = await EmbedHelper.createNominationEmbeds(
        interaction.user,
        message,
      );

      // Add users vote to the nomination
      await votingService.addOrUpdateVote(
        result.nomination.id,
        nominator,
        'up'
      );

      // TODO, i think it's be cool to update the nomination post with the live vote count
      // But to do that I'll need to update/create a new schema for storing the nomination message ID (and xpost id)
      // And I don't think I can get the nomination message or the x-post nomination message ID before it's posted here.
      // I think I'll need to get it the first time someone votes on it, since I can't know
      // What it'll be before it's posted (i think). 

      const voteUpButton = new ButtonBuilder()
        .setCustomId(`vote_up_${result.nomination.id}`)
        .setLabel('🔥')
        .setStyle(ButtonStyle.Success);
      const voteDownButton = new ButtonBuilder()
        .setCustomId(`vote_down_${result.nomination.id}`)
        .setLabel('💩')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(voteUpButton, voteDownButton);

      await interaction.reply({
        content: '✅ Nomination added successfully!', // TODO: replace this with the helper function that generates the nomination confirmation text
        embeds: embeds,
        files: files ?? [],
        components: [row],
      });
    } else if (result.error === 'ALREADY_NOMINATED') {
      if (result.nomination) {
        await votingService.addOrUpdateVote(
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
      content: '❌ There was an error adding this nomination.',
      flags: MessageFlags.Ephemeral
    });
  }
}