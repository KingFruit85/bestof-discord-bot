export const MIN_AGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface WaitFields {
  created_at: Date;
  waiting_since: Date | null;
}

export function waitStart(nomination: WaitFields, minAgeDays = MIN_AGE_DAYS): Date {
  return nomination.waiting_since ?? new Date(nomination.created_at.getTime() + minAgeDays * DAY_MS);
}

export function waitWeight(nomination: WaitFields, now: Date, minAgeDays = MIN_AGE_DAYS): number {
  const days = (now.getTime() - waitStart(nomination, minAgeDays).getTime()) / DAY_MS;
  return Math.max(0, days) + 1;
}

export function pickWeighted<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  random: () => number = Math.random
): T | null {
  if (items.length === 0) return null;
  const weights = items.map(weightOf);
  let remaining = random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < items.length; i++) {
    remaining -= weights[i]!;
    if (remaining < 0) return items[i]!;
  }
  return items[items.length - 1]!;
}
