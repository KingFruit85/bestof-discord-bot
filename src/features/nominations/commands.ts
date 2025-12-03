import { ApplicationCommandType, ContextMenuCommandBuilder, SlashCommandBuilder } from "discord.js";

export const addNominationCommand = new ContextMenuCommandBuilder()
    .setName('Add Nomination')
    .setType(ApplicationCommandType.Message);
