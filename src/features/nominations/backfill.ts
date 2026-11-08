/**
 * One-off backfill of nominations.author_id for nominations made before the
 * bot recorded authors. Discord I/O and DB writes are injected, so the loop is
 * unit-testable; src/scripts/backfill-authors.ts wires in the real ones.
 */
import { parseMessageLink, type MessageRef } from '../../shared/message-link.js';

export type AuthorLookup =
  | { status: 'found'; authorId: string }
  /** The message, channel, or server is gone or unreadable: retrying won't help. */
  | { status: 'missing' };

export interface BackfillRow {
  id: number;
  message_link: string;
}

export interface BackfillSummary {
  found: number;
  missing: number;
  invalidLink: number;
  /** Unexpected errors (network, rate limits); those rows stay NULL and a rerun retries them. */
  failed: number;
}

export async function backfillAuthors(
  rows: readonly BackfillRow[],
  deps: {
    lookupAuthor: (ref: MessageRef) => Promise<AuthorLookup>;
    saveAuthor: (nominationId: number, authorId: string) => Promise<void>;
    dryRun?: boolean;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<BackfillSummary> {
  const summary: BackfillSummary = { found: 0, missing: 0, invalidLink: 0, failed: 0 };
  for (const [index, row] of rows.entries()) {
    const ref = parseMessageLink(row.message_link);
    if (!ref) {
      summary.invalidLink++;
    } else {
      try {
        const result = await deps.lookupAuthor(ref);
        if (result.status === 'found') {
          if (!deps.dryRun) await deps.saveAuthor(row.id, result.authorId);
          summary.found++;
        } else {
          summary.missing++;
        }
      } catch (error) {
        console.warn(`Nomination ${row.id}: lookup failed:`, error instanceof Error ? error.message : error);
        summary.failed++;
      }
    }
    deps.onProgress?.(index + 1, rows.length);
  }
  return summary;
}
