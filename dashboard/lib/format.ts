export type StatusFilter = 'all' | 'pool';
export type SortOrder = 'newest' | 'oldest' | 'score';
export type SearchParamValue = string | string[] | undefined;

const DAY_MS = 86_400_000;

/** Nominations created this close to their posting date count as "recent". */
export const RECENT_WINDOW_DAYS = 90;

/** Where the bot starts a new cycle. Keep in sync with RESET_THRESHOLD in src/features/scheduling/cycle.ts. */
export const RESET_THRESHOLD = 0.9;

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

/** Parses DASHBOARD_SERVER_NAMES. Anything malformed yields an empty map. */
export function parseServerNames(json: string | undefined): Record<string, string> {
  if (!json) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
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
