/**
 * When to start a new random-post cycle early.
 *
 * Without this, schedule_history only clears once every nomination has been
 * posted, so late in a cycle the remaining pool is mostly recent nominations
 * and random posts skew recent. Resetting at a threshold keeps the pool mixed.
 */

/** Fraction of postable nominations posted before a new cycle starts. */
export const RESET_THRESHOLD = 0.9;

export interface CycleProgress {
  /** All nominations for the guild. */
  total: number;
  /** Nominations posted this cycle. */
  posted: number;
  /** Nominations skipped this cycle because their message could not be fetched. */
  skipped: number;
}

export function shouldStartNewCycle(progress: CycleProgress, threshold = RESET_THRESHOLD): boolean {
  const postable = progress.total - progress.skipped;
  if (postable <= 0 || progress.posted <= 0) return false;
  return progress.posted / postable >= threshold;
}
