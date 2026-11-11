export type StatusFilter = 'all' | 'pool';
export type SortOrder = 'newest' | 'oldest' | 'score';
export type SearchParamValue = string | string[] | undefined;

const DAY_MS = 86_400_000;

/** Nominations created this close to their posting date count as "recent". */
export const RECENT_WINDOW_DAYS = 90;

/** Where the bot starts a new cycle. Keep in sync with RESET_THRESHOLD in src/features/scheduling/cycle.ts. */
export const RESET_THRESHOLD = 0.9;

/** Days before a nomination joins the pool. Keep in sync with MIN_AGE_DAYS in src/features/scheduling/cycle.ts. */
export const MIN_AGE_DAYS = 30;

export function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseStatus(value: SearchParamValue): StatusFilter {
  return firstParam(value) === 'pool' ? 'pool' : 'all';
}

/** part / total, or null when total is zero. */
export function fraction(part: number, total: number): number | null {
  return total > 0 ? part / total : null;
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

export function formatAge(ms: number): string {
  const days = Math.floor(ms / DAY_MS);
  if (days < 1) return 'under a day';
  if (days < 14) return plural(days, 'day');
  if (days < 60) return plural(Math.floor(days / 7), 'wk');
  if (days < 730) return plural(Math.floor(days / 30), 'mo');
  return plural(Math.floor(days / 365), 'yr');
}

export function isRecent(postedAt: Date, nominatedAt: Date, windowDays = RECENT_WINDOW_DAYS): boolean {
  return postedAt.getTime() - nominatedAt.getTime() < windowDays * DAY_MS;
}

export function serverName(guildId: string, names: Record<string, string>): string {
  return names[guildId] ?? guildId;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateTime(d: Date): string {
  const text = d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
  return `${text} UTC`;
}

/** Builds a page URL from the current params plus overrides, dropping empty values. */
export function buildHref(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...overrides })) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

/** Time window for the leaderboards and hall of fame, kept in the URL as ?period=. */
export type Period = '30d' | '12m' | 'all';

export const PERIODS: readonly { value: Period; label: string; days: number | null }[] = [
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '12m', label: 'Last 12 months', days: 365 },
  { value: 'all', label: 'All time', days: null },
];

export function parsePeriod(value: SearchParamValue): Period {
  const raw = firstParam(value);
  return PERIODS.find((p) => p.value === raw)?.value ?? 'all';
}

/** Window length in days, or null for all time. */
export function periodDays(period: Period): number | null {
  return PERIODS.find((p) => p.value === period)?.days ?? null;
}

/**
 * Servers the dashboard never shows: KFruit's server, the bot's dev/test
 * server. Its nominations would skew the leaderboards in "All servers".
 */
export const HIDDEN_GUILD_IDS: readonly string[] = ['1054500338947858522'];

export interface Scope {
  /** The server picked in the filter, or null for all visible servers. */
  selected: string | null;
  /** Every server the filter may offer. */
  visible: string[];
  /** The servers the page's queries cover. */
  guildIds: string[];
}

/** Which servers to show. A hidden or unknown ?guild= falls back to all visible servers. */
export function resolveScope(requested: string | undefined, allGuildIds: readonly string[], hidden = HIDDEN_GUILD_IDS): Scope {
  const visible = allGuildIds.filter((id) => !hidden.includes(id));
  const selected = requested && visible.includes(requested) ? requested : null;
  return { selected, visible, guildIds: selected ? [selected] : visible };
}
