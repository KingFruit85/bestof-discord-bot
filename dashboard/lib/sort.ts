// Column sorting for the dashboard tables. Sort state lives in the URL as
// "<key>" (ascending) or "-<key>" (descending), one param per table, so
// header links work without client-side JavaScript.

export type SortDir = 'asc' | 'desc';

export interface SortState {
  key: string;
  dir: SortDir;
}

export type SortValue = string | number | boolean | Date | null | undefined;

export interface Column<T> {
  key: string;
  label: string;
  /** Omit to make the column unsortable (e.g. jump links). */
  value?: (row: T) => SortValue;
  /** Direction used the first time the header is clicked. Defaults to 'asc'. */
  defaultDir?: SortDir;
}

export function parseSortParam(value: string | undefined, allowedKeys: readonly string[], fallback: SortState): SortState {
  if (!value) return fallback;
  const desc = value.startsWith('-');
  const key = desc ? value.slice(1) : value;
  return allowedKeys.includes(key) ? { key, dir: desc ? 'desc' : 'asc' } : fallback;
}

export function formatSortParam(state: SortState): string {
  return state.dir === 'desc' ? `-${state.key}` : state.key;
}

/** Clicking the active column flips it; clicking another starts at its default direction. */
export function nextSort(current: SortState, key: string, defaultDir: SortDir): SortState {
  if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: defaultDir };
}

function normalize(value: SortValue): string | number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

/** Stable sort that never mutates its input. Empty values sort last in both directions. */
export function sortRows<T>(rows: readonly T[], accessor: (row: T) => SortValue, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((rowA, rowB) => {
    const a = normalize(accessor(rowA));
    const b = normalize(accessor(rowB));
    if (a === null || b === null) {
      if (a === b) return 0;
      return a === null ? 1 : -1;
    }
    if (typeof a === 'number' && typeof b === 'number') return sign * (a - b);
    // numeric: digit runs compare by value, so long Discord IDs order correctly.
    return sign * String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
  });
}

export function applySort<T>(
  rows: readonly T[],
  columns: readonly Column<T>[],
  param: string | undefined,
  fallback: SortState,
): { rows: T[]; state: SortState } {
  const sortable = columns.filter((column) => column.value);
  const state = parseSortParam(param, sortable.map((column) => column.key), fallback);
  const column = sortable.find((c) => c.key === state.key);
  return { rows: column?.value ? sortRows(rows, column.value, state.dir) : [...rows], state };
}
