import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  EmbedBuilder,
  type Message,
  type MessageContextMenuCommandInteraction,
  MessageFlags,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  TextChannel,
  type User,
} from 'discord.js';
import { EmbedHelper, GreetingHelper, MessageHelper } from '#shared';
import { addOrUpdateVote, type VotingService, type VoteSource } from '#voting';
import { updateNominationMessageId, getNominationByLink, type NominationService } from '#nominations';
import { getGuildConfig } from '#guild-config';

const CHRIS_USER_ID = '317070992339894273';
const TROPHY_EMOJI = '🏆';

interface NominationOutcome {
  status: 'created' | 'already_nominated' | 'already_nominated_unknown' | 'failed';
}

/**
 * Shared by both the context-menu path and the trophy-reaction path:
 * creates the nomination, builds the embeds, posts the announcement
 * (+ crosspost), persists the announcement message id, and records the
 * nominator's initial up-vote.
 */
async function createAndPostNomination(
  message: Message,
  nominator: User,
  client: Client,
  nominationService: NominationService,
  source: VoteSource
): Promise<NominationOutcome> {
  const guildId = message.guildId!;
  const messageLink = message.url;

  const result = await nominationService.addNomination(guildId, messageLink, nominator.id);

  if (result.error === 'ALREADY_NOMINATED') {
    if (!result.nomination) {
      return { status: 'already_nominated_unknown' };
    }
    await addOrUpdateVote(result.nomination.id, nominator.id, 'up', source);
    return { status: 'already_nominated' };
  }

  if (!(result.success && result.nomination)) {
    return { status: 'failed' };
  }

  const channel = message.channel as TextChannel;

  // create the embedded reply that'll be posted to the channel the comment
  // was nominated from
  let { embeds, files, mediaUrls } = await EmbedHelper.createNominationEmbeds(message);

  // Add nominator's vote to the nomination
  await addOrUpdateVote(result.nomination.id, nominator.id, 'up', source);

  const voteUpButton = new ButtonBuilder()
    .setCustomId(`vote_up_${result.nomination.id}`)
    .setLabel('🔥')
    .setStyle(ButtonStyle.Success);
  const voteDownButton = new ButtonBuilder()
    .setCustomId(`vote_down_${result.nomination.id}`)
    .setLabel('💩')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(voteUpButton, voteDownButton);

  // Cross post to nomination channel as long as the origin isn't the nomination channel
  const guildConfig = await getGuildConfig(guildId);

  if (guildConfig?.allow_crossposts && guildConfig.nomination_channel) {
    try {
      const nominationChannel = await client.channels.fetch(guildConfig.nomination_channel);

      // This should prevent double posting in the nomination channel
      const originChannelIsNominationChannel = channel.id === nominationChannel?.id;

      let embedsWithoutVoteCounter = embeds.slice(0, -1);

      const tail = new EmbedBuilder().addFields({
        name: "🔗 Message Link",
        value: `[Jump to message](${message.url})`,
      });

      embedsWithoutVoteCounter.push(tail);

      if (nominationChannel && nominationChannel instanceof TextChannel && !originChannelIsNominationChannel) {
        await nominationChannel.send({
          content: [
            GreetingHelper.crosspostGreeting(channel, nominator, message),
            ...mediaUrls,
          ].join('\n'),
          embeds: embedsWithoutVoteCounter,
          files: files ?? [],
        });
      }
    } catch (error) {
      console.error(`Error crossposting nomination for guild ${guildId}:`, error);
      // Do not send error to user, just log it
    }
  }

  // Post announcement in the origin channel
  const replyMessage = await channel.send({
    content: [
      GreetingHelper.generalChannelGreeting(channel, nominator, message),
      ...mediaUrls,
    ].join('\n'),
    embeds,
    files: files ?? [],
    components: [row],
  });

  if (replyMessage) {
    await updateNominationMessageId(result.nomination.id, replyMessage.id);
  }

  return { status: 'created' };
}

export async function handleAddNomination(
  interaction: MessageContextMenuCommandInteraction,
  nominationService: NominationService,
) {
  const messageLink = interaction.targetMessage.url;
  const nominator = interaction.user;

  // this is the nominated message
  const message = await MessageHelper.getMessageFromLink(interaction.client, messageLink);

  // Validate message
  if (!message) {
    await interaction.reply({
      content: 'Could not find the message to nominate. It may have been deleted.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // early return if the message author is a bot or trying to nominate themselves
  if (message.author.bot) {
    await interaction.reply({
      content: 'You cannot nominate messages from bots.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (message.author.id === nominator.id && message.author.id !== CHRIS_USER_ID) {
    await interaction.reply({
      content: GreetingHelper.userNominatingOwnMessage(nominator),
    });
    return;
  }

  try {
    await interaction.deferReply({ ephemeral: true });

    const outcome = await createAndPostNomination(
      message,
      nominator,
      interaction.client,
      nominationService,
      'button'
    );

    switch (outcome.status) {
      case 'created':
        await interaction.editReply({ content: 'Nomination submitted!' });
        break;
      case 'already_nominated':
        await interaction.editReply({
          content: "This message has already been nominated! Your vote has been added to the existing nomination if it wasn't already.",
        });
        break;
      case 'already_nominated_unknown':
        await interaction.editReply({
          content: 'This message has already been nominated, but the original nomination could not be retrieved.',
        });
        break;
      case 'failed':
        await interaction.editReply({
          content: 'There was an error adding this nomination.',
        });
        break;
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    await interaction.editReply({
      content: 'There was an error adding this nomination.',
    });
  }
}

export async function handleTrophyReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  nominationService: NominationService,
  votingService: VotingService,
): Promise<void> {
  if (reaction.emoji.name !== TROPHY_EMOJI) return;

  let fullUser: User;
  let fullMessage: Message;

  try {
    fullUser = user.partial ? await user.fetch() : user;
    fullMessage = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
  } catch (error) {
    console.error('Error fetching partial trophy reaction data:', error);
    return;
  }

  if (fullUser.bot || !fullMessage.guildId) return;

  const existingNomination = await getNominationByLink(fullMessage.url);

  if (!existingNomination) {
    if (fullMessage.author.bot) return;

    if (fullMessage.author.id === fullUser.id && fullMessage.author.id !== CHRIS_USER_ID) {
      await (fullMessage.channel as TextChannel).send({
        content: GreetingHelper.userNominatingOwnMessage(fullUser),
      });
      return;
    }

    await createAndPostNomination(fullMessage, fullUser, fullMessage.client, nominationService, 'reaction');
    return;
  }

  await votingService.addOrUpdateVote(
    fullMessage.client,
    fullMessage.channelId,
    existingNomination.id,
    fullUser.id,
    'up',
    'reaction'
  );
}

export async function handleTrophyReactionRemove(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  votingService: VotingService,
): Promise<void> {
  if (reaction.emoji.name !== TROPHY_EMOJI) return;

  let fullUser: User;
  let fullMessage: Message;

  try {
    fullUser = user.partial ? await user.fetch() : user;
    fullMessage = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
  } catch (error) {
    console.error('Error fetching partial trophy reaction data:', error);
    return;
  }

  if (fullUser.bot || !fullMessage.guildId) return;

  const nomination = await getNominationByLink(fullMessage.url);
  if (!nomination) return;

  await votingService.removeReactionVote(
    fullMessage.client,
    fullMessage.channelId,
    nomination.id,
    fullUser.id
  );
}
