// Pure helpers for the server-rendered charts and leaderboard bars.

export interface MonthCount {
  /** 'YYYY-MM' */
  month: string;
  count: number;
}

function nextMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`;
}

/** Every month from the first row's through `end`, with missing months as 0. Rows must be sorted. */
export function fillMonths(rows: readonly MonthCount[], end: string): MonthCount[] {
  if (rows.length === 0) return [];
  const counts = new Map(rows.map((r) => [r.month, r.count]));
  const last = rows[rows.length - 1].month > end ? rows[rows.length - 1].month : end;
  const filled: MonthCount[] = [];
  for (let month = rows[0].month; month <= last; month = nextMonth(month)) {
    filled.push({ month, count: counts.get(month) ?? 0 });
  }
  return filled;
}

/** Smallest of 1, 2, 3, 4, 5, 6, 8, or 10 × 10^k that is at least `max`, for an axis top that wastes little height. */
export function niceMax(max: number): number {
  if (max <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 3, 4, 5, 6, 8, 10]) {
    if (step * magnitude >= max) return step * magnitude;
  }
  return 10 * magnitude;
}

/** The halfway gridline's label, or null when it would be fractional. */
export function axisMid(top: number): number | null {
  return Number.isInteger(top / 2) && top > 1 ? top / 2 : null;
}

/** value / max clamped to 0..1, for bar widths and heights. */
export function barShare(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthLabel(month: string): string {
  const [year, m] = month.split('-');
  return `${MONTHS[Number(m) - 1]} ${year}`;
}
