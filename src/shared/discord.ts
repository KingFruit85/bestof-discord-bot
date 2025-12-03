import { Client } from 'discord.js';

export class MessageHelper {

    public static async getMessageFromLink(client: Client, messageLink: string) {
      try {
        const url = new URL(messageLink);
        const pathParts = url.pathname.split('/').filter(Boolean);
    
        if (pathParts.length < 4) {
          throw new Error('Invalid message link format');
        }
    
        // pathParts[0] is something like "channels" which we can ignore
        const guildId = pathParts[1];
        const channelId = pathParts[2];
        const messageId = pathParts[3];
    
        if (!guildId || !channelId || !messageId) {
          throw new Error('Error: unable to split out the message link components');
        }
    
        const guild = await client.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
          throw new Error('Channel not found or is not text-based');
        }
    
        const message = await channel.messages.fetch(messageId);
        return message;
      } catch (error) {
        console.error('Error fetching message from link:', error);
        throw error;
      }
    }
}
