// Server-side pagination for the dashboard tables. The page number lives in
// the URL, so pager links work without client-side JavaScript.

export interface Page<T> {
  rows: T[];
  /** The page actually shown, after clamping. */
  page: number;
  pageCount: number;
  /** 1-based position of the first and last row shown; both 0 when empty. */
  start: number;
  end: number;
}

export function paginate<T>(rows: readonly T[], page: number, pageSize: number): Page<T> {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const offset = (current - 1) * pageSize;
  const slice = rows.slice(offset, offset + pageSize);
  return {
    rows: slice,
    page: current,
    pageCount,
    start: slice.length ? offset + 1 : 0,
    end: offset + slice.length,
  };
}

/** A positive integer page number from the URL, or 1. */
export function parsePage(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  return Math.max(1, Number(value));
}

/** Page numbers to link: first, last, and the current page's neighbours; null marks a gap. */
export function pageWindow(page: number, pageCount: number): (number | null)[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...wanted].sort((a, b) => a - b);
  const result: (number | null)[] = [];
  for (const p of sorted) {
    const prev = result[result.length - 1];
    if (typeof prev === 'number' && p - prev > 1) result.push(null);
    result.push(p);
  }
  return result;
}
