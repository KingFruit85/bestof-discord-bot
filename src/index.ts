import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from 'dotenv';
import { VotingService } from '#voting';
import {
  handleConfigureBotCommand,
  handleNominationChannelChange,
  handleRandomPostScheduleChange,
  handleAllowCrosspostsChange,
  handleEnableMonthlyRecapChange,
  NOMINATION_CHANNEL_SELECT_ID,
  RANDOM_POST_SCHEDULE_SELECT_ID,
  ALLOW_CROSSPOSTS_SELECT_ID,
  ENABLE_MONTHLY_RECAP_SELECT_ID,
} from './features/guild_config/handlers.js';
import { closePool, testConnection } from '#config';
import { handleAddNomination, NominationService } from '#nominations';
import { CONFIGURE_BOT_COMMAND } from '#guild-config';
import { Scheduler, SchedulingService } from '#scheduling';
import * as http from 'http';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Initialize services
const nominationService = new NominationService();
const votingService = new VotingService();
const schedulingService = new SchedulingService(client);
const scheduler = new Scheduler(schedulingService);

// Start dummy HTTP server for Fly.io health checks
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP server listening on 0.0.0.0:${PORT}`);
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Bot is ready! Logged in as ${readyClient.user.tag}`);

  // Test database connection
  await testConnection();

  console.log(`Connected to ${readyClient.guilds.cache.size} guild(s)`);

  scheduler.start();

  console.log(`Waiting for interactions...`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isMessageContextMenuCommand()) {
      if (interaction.commandName === 'Add Nomination') {
        await handleAddNomination(interaction, nominationService);
      }
    } else if (
      interaction.isChatInputCommand() &&
      interaction.commandName === CONFIGURE_BOT_COMMAND.name
    ) {
      await handleConfigureBotCommand(interaction);
    } else if (interaction.isChannelSelectMenu()) {
      if (interaction.customId === NOMINATION_CHANNEL_SELECT_ID) {
        await handleNominationChannelChange(interaction);
      }
    } else if (interaction.isStringSelectMenu()) {
      switch (interaction.customId) {
        case RANDOM_POST_SCHEDULE_SELECT_ID:
          await handleRandomPostScheduleChange(interaction);
          break;
        case ALLOW_CROSSPOSTS_SELECT_ID:
          await handleAllowCrosspostsChange(interaction);
          break;
        case ENABLE_MONTHLY_RECAP_SELECT_ID:
          await handleEnableMonthlyRecapChange(interaction);
          break;
      }
    }

    if (interaction.isButton()) {
      console.log('Button interaction received:', interaction.customId);
      const [action, voteType, nominationId] = interaction.customId.split('_');

      if (!action || !voteType || !nominationId) {
        await interaction.reply({
          content: 'Invalid button interaction.',
          ephemeral: true,
        });
        return;
      }
      const userId = interaction.user.id;

      if (action === 'vote') {
        await votingService.addOrUpdateVote(
          interaction,
          Number(nominationId),
          userId,
          voteType as 'up' | 'down'
        );

        await interaction.reply({
          content: `Your vote has been recorded, thanks!`,
          ephemeral: true,
        });
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log(' Shutting down...');
  scheduler.stop();
  client.destroy();
  await closePool();
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  scheduler.stop();
  client.destroy();
  await closePool();
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

client.login(process.env.DISCORD_TOKEN);