import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from 'dotenv';
import { testConnection, closePool } from './config/database.js';
import { NominationService } from './features/nominations/service.js';
import { handleAddNomination } from './features/nominations/handlers.js';
import { VotingService } from '#voting';
import { SchedulingService } from './features/scheduling/service.js';

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

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Bot is ready! Logged in as ${readyClient.user.tag}`);

  // Test database connection
  await testConnection();

  console.log(`Connected to ${readyClient.guilds.cache.size} guild(s)`);
  
  // Post a random nomination to each guild
  readyClient.guilds.cache.forEach(guild => {
    schedulingService.postRandomNomination(guild.id);
  });

  console.log(`Waiting for interactions...`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isMessageContextMenuCommand()) {
      if (interaction.commandName === 'Add Nomination') {
        await handleAddNomination(interaction, nominationService);
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
  client.destroy();
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  client.destroy();
  await closePool();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);