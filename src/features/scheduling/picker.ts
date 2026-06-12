export interface PickerDeps<T extends { message_link: string }, M> {
  /** Random nomination not yet in schedule_history, or null if pool exhausted */
  getCandidate: () => Promise<T | null>;
  /** Clear schedule_history so a new cycle can begin */
  resetHistory: () => Promise<void>;
  /** Fetch the original Discord message; throws if it no longer exists */
  fetchMessage: (messageLink: string) => Promise<M>;
  /** Record a nomination whose message is gone so it stops being picked */
  markUnpostable: (messageLink: string) => Promise<void>;
  maxAttempts?: number;
}

export async function pickPostableNomination<T extends { message_link: string }, M>(
  deps: PickerDeps<T, M>
): Promise<{ nomination: T; message: M } | null> {
  const maxAttempts = deps.maxAttempts ?? 10;
  let hasReset = false;

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
