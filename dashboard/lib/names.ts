import { unstable_cache } from 'next/cache';
import { createRateGate, displayName, fetchDiscord, resolveNames, type DiscordGuild, type DiscordUser } from './discord';

// Names are cached per ID for a day: usernames change, so they are never
// stored, but a day-old name is fine for this dashboard.
//
// Why unstable_cache rather than fetch's next.revalidate: page.tsx sets
// dynamic = 'force-dynamic', which forces every fetch() on the page to
// no-store, silently ignoring per-fetch revalidate. unstable_cache isn't
// affected. Next 16 supersedes it with 'use cache' (needs Cache Components);
// all caching lives in this file so that migration stays local.

const ONE_DAY_SECONDS = 86_400;

// One gate per Discord route bucket, kept for the life of the server process,
// so lookups stop before draining the allowance the live bot shares.
const userGate = createRateGate();
const guildGate = createRateGate();

function token(): string {
  const value = process.env.DASHBOARD_DISCORD_TOKEN;
  if (!value) throw new Error('DASHBOARD_DISCORD_TOKEN is not set');
  return value;
}

// Only reached on a cache miss, so each log line is one real Discord request.
const userName = unstable_cache(
  async (id: string): Promise<string | null> => {
    console.info(`[discord] fetching user ${id}`);
    const user = await fetchDiscord<DiscordUser>(`/users/${id}`, { fetch, token: token(), gate: userGate });
    return user ? displayName(user) : null;
  },
  ['discord-user-name-v1'],
  { revalidate: ONE_DAY_SECONDS },
);

const guildName = unstable_cache(
  async (id: string): Promise<string | null> => {
    console.info(`[discord] fetching guild ${id}`);
    const guild = await fetchDiscord<DiscordGuild>(`/guilds/${id}`, { fetch, token: token(), gate: guildGate });
    return guild?.name ?? null;
  },
  ['discord-guild-name-v1'],
  { revalidate: ONE_DAY_SECONDS },
);

export interface ResolvedNames {
  users: Record<string, string>;
  guilds: Record<string, string>;
  /** False when no token is configured; the page then shows raw IDs. */
  available: boolean;
}

/** Never throws: any failure leaves that ID out, and the page shows it raw. */
export async function lookupNames(userIds: readonly string[], guildIds: readonly string[]): Promise<ResolvedNames> {
  if (!process.env.DASHBOARD_DISCORD_TOKEN) return { users: {}, guilds: {}, available: false };
  try {
    const [users, guilds] = await Promise.all([resolveNames(userIds, 4, userName), resolveNames(guildIds, 2, guildName)]);
    return { users, guilds, available: true };
  } catch (error) {
    console.error('Discord name lookup failed:', error);
    return { users: {}, guilds: {}, available: true };
  }
}
