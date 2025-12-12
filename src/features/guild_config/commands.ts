import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const CONFIGURE_BOT_COMMAND = new SlashCommandBuilder()
  .setName('configure')
  .setDescription('Configure the bot for this guild.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
