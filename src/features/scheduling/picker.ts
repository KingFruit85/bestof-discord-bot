export interface PickerDeps<T extends { message_link: string }, M> {
  /** Random nomination not yet in schedule_history, or null if pool exhausted */
  getCandidate: () => Promise<T | null>;
  /** Clear schedule_history so a new cycle can begin */
  resetHistory: () => Promise<void>;
  /** Fetch the original Discord message; throws if it no longer exists */
  fetchMessage: (messageLink: string) => Promise<M>;
  /** Record a nomination whose message is gone so it stops being picked */
  markUnpostable: (messageLink: string) => Promise<void>;
  /** Whether the cycle is far enough along to start a new one before picking. Optional. */
  shouldReset?: () => Promise<boolean>;
  maxAttempts?: number;
}

export async function pickPostableNomination<T extends { message_link: string }, M>(
  deps: PickerDeps<T, M>
): Promise<{ nomination: T; message: M } | null> {
  const maxAttempts = deps.maxAttempts ?? 10;
  let hasReset = false;

  // A threshold reset counts as this run's one reset, so an exhausted pool
  // right afterwards can't trigger a second.
  if (deps.shouldReset && (await deps.shouldReset())) {
    await deps.resetHistory();
    hasReset = true;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let nomination = await deps.getCandidate();

    if (!nomination && !hasReset) {
      await deps.resetHistory();
      hasReset = true;
      nomination = await deps.getCandidate();
    }

    if (!nomination) {
      return null;
    }

    try {
      const message = await deps.fetchMessage(nomination.message_link);
      return { nomination, message };
    } catch {
      await deps.markUnpostable(nomination.message_link);
    }
  }

  return null;
}
