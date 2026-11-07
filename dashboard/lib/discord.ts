// Minimal Discord REST client for looking up names. No Next.js imports, and
// fetch/sleep are injected, so it can be unit tested without the network.

const API_BASE = 'https://discord.com/api/v10';
const USER_AGENT = 'DiscordBot (https://github.com/KingFruit85/bestof-discord-bot, 1.0)';

/** Longest rate-limit wait worth sitting through while a page renders. */
const MAX_RETRY_WAIT_SECONDS = 2;

/**
 * Requests left in a rate-limit window that the dashboard never uses. The live
 * bot shares this token's buckets (e.g. 30 user lookups per ~30 s), so the
 * dashboard stops early instead of draining them, and leftovers wait for a
 * later page load.
 */
const RESERVED_REQUESTS = 5;

/** Shared across lookups on one route so they all stop once the reserve is reached. */
export interface RateGate {
  /** Epoch ms before which no request is sent. */
  blockedUntil: number;
  /** Requests sent but not yet answered; each will still consume allowance. */
  inFlight: number;
}

export function createRateGate(): RateGate {
  return { blockedUntil: 0, inFlight: 0 };
}

function closeGate(gate: RateGate, now: number, seconds: number): void {
  gate.blockedUntil = Math.max(gate.blockedUntil, now + Math.ceil(seconds * 1000));
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
}

export interface DiscordGuild {
  id: string;
  name: string;
}

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{ status: number; json(): Promise<unknown>; headers: { get(name: string): string | null } }>;

export class DiscordLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscordLookupError';
  }
}

export function displayName(user: Pick<DiscordUser, 'username' | 'global_name'>): string {
  return user.global_name?.trim() || user.username;
}

/**
 * GET a Discord resource. Returns null on 404 (unknown user, or the bot isn't
 * in that server), which callers may cache. Throws on everything else, so a
 * rate limit or outage is never cached as a result.
 */
export async function fetchDiscord<T>(
  path: string,
  deps: {
    fetch: FetchLike;
    token: string;
    sleep?: (ms: number) => Promise<void>;
    /** Optional pacing shared by every lookup on the same route. */
    gate?: RateGate;
    now?: () => number;
  },
): Promise<T | null> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? Date.now;
  const init = { headers: { Authorization: `Bot ${deps.token}`, 'User-Agent': USER_AGENT } };

  for (let attempt = 0; attempt < 2; attempt++) {
    if (deps.gate && now() < deps.gate.blockedUntil) {
      throw new DiscordLookupError(`Skipped Discord GET ${path}: keeping the rate-limit reserve for the bot`);
    }

    if (deps.gate) deps.gate.inFlight++;
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await deps.fetch(`${API_BASE}${path}`, init);
    } finally {
      if (deps.gate) deps.gate.inFlight--;
    }

    if (deps.gate) {
      // Requests still in flight will each use one more, so count them as spent.
      const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? NaN) - deps.gate.inFlight;
      const resetAfter = Number(res.headers.get('x-ratelimit-reset-after') ?? NaN);
      if (Number.isFinite(remaining) && Number.isFinite(resetAfter) && remaining <= RESERVED_REQUESTS) {
        closeGate(deps.gate, now(), resetAfter);
      }
    }

    if (res.status === 200) return (await res.json()) as T;
    if (res.status === 404) return null;

    if (res.status === 429 && attempt === 0) {
      const body = (await res.json().catch(() => ({}))) as { retry_after?: unknown };
      const seconds = typeof body.retry_after === 'number' ? body.retry_after : Number(res.headers.get('retry-after'));
      if (Number.isFinite(seconds) && seconds <= MAX_RETRY_WAIT_SECONDS) {
        await sleep(Math.ceil(seconds * 1000));
        continue;
      }
      if (deps.gate && Number.isFinite(seconds)) closeGate(deps.gate, now(), seconds);
    }
    throw new DiscordLookupError(`Discord GET ${path} returned ${res.status}`);
  }
  throw new DiscordLookupError(`Discord GET ${path} was rate limited twice`);
}

/** Like Promise.all over items.map(fn), but with at most `limit` calls in flight. */
export async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Resolve IDs to names. IDs whose lookup returns null or throws are left out,
 * so callers fall back to showing the raw ID.
 */
export async function resolveNames(
  ids: readonly string[],
  concurrency: number,
  lookup: (id: string) => Promise<string | null>,
): Promise<Record<string, string>> {
  const unique = [...new Set(ids)];
  const names = await mapWithConcurrency(unique, concurrency, async (id) => {
    try {
      return await lookup(id);
    } catch (error) {
      console.warn(`Discord name lookup failed for ${id}:`, error instanceof Error ? error.message : error);
      return null;
    }
  });
  const result: Record<string, string> = {};
  unique.forEach((id, i) => {
    const name = names[i];
    if (name) result[id] = name;
  });
  return result;
}
