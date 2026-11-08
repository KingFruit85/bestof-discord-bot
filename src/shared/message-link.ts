export interface MessageRef {
  guildId: string;
  channelId: string;
  messageId: string;
}

const DISCORD_HOSTS = new Set(['discord.com', 'canary.discord.com', 'ptb.discord.com', 'discordapp.com']);
const SNOWFLAKE = /^\d+$/;

/** Splits https://discord.com/channels/<guild>/<channel>/<message> into IDs, or null if it isn't one. */
export function parseMessageLink(link: string): MessageRef | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (!DISCORD_HOSTS.has(url.hostname)) return null;
  const [prefix, guildId, channelId, messageId] = url.pathname.split('/').filter(Boolean);
  if (prefix !== 'channels' || !guildId || !channelId || !messageId) return null;
  if (![guildId, channelId, messageId].every((id) => SNOWFLAKE.test(id))) return null;
  return { guildId, channelId, messageId };
}
