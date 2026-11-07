import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySort, formatSortParam, nextSort, parseSortParam, sortRows, type Column } from '../lib/sort';

const FALLBACK = { key: 'date', dir: 'desc' } as const;

test('parseSortParam reads a key with an optional leading minus for descending', () => {
  assert.deepEqual(parseSortParam('net', ['net', 'date'], FALLBACK), { key: 'net', dir: 'asc' });
  assert.deepEqual(parseSortParam('-net', ['net', 'date'], FALLBACK), { key: 'net', dir: 'desc' });
});

test('parseSortParam falls back on missing or unknown keys', () => {
  assert.deepEqual(parseSortParam(undefined, ['net'], FALLBACK), FALLBACK);
  assert.deepEqual(parseSortParam('', ['net'], FALLBACK), FALLBACK);
  assert.deepEqual(parseSortParam('-drop table', ['net'], FALLBACK), FALLBACK);
});

test('formatSortParam round-trips through parseSortParam', () => {
  assert.equal(formatSortParam({ key: 'net', dir: 'desc' }), '-net');
  assert.equal(formatSortParam({ key: 'net', dir: 'asc' }), 'net');
  const state = { key: 'net', dir: 'desc' } as const;
  assert.deepEqual(parseSortParam(formatSortParam(state), ['net'], FALLBACK), state);
});

test('nextSort flips the active column and uses the default direction for a new one', () => {
  assert.deepEqual(nextSort({ key: 'net', dir: 'desc' }, 'net', 'desc'), { key: 'net', dir: 'asc' });
  assert.deepEqual(nextSort({ key: 'net', dir: 'asc' }, 'net', 'desc'), { key: 'net', dir: 'desc' });
  assert.deepEqual(nextSort({ key: 'net', dir: 'asc' }, 'server', 'asc'), { key: 'server', dir: 'asc' });
  assert.deepEqual(nextSort({ key: 'server', dir: 'asc' }, 'net', 'desc'), { key: 'net', dir: 'desc' });
});

test('sortRows orders numbers, dates, and booleans by value', () => {
  assert.deepEqual(sortRows([3, 10, 1], (n) => n, 'asc'), [1, 3, 10]);
  assert.deepEqual(sortRows([3, 10, 1], (n) => n, 'desc'), [10, 3, 1]);
  const d = (s: string) => new Date(s);
  const dates = [d('2024-01-01'), d('2026-01-01'), d('2023-01-01')];
  assert.deepEqual(sortRows(dates, (x) => x, 'desc'), [d('2026-01-01'), d('2024-01-01'), d('2023-01-01')]);
  assert.deepEqual(sortRows([true, false, true], (x) => x, 'asc'), [false, true, true]);
});

test('sortRows compares strings case-insensitively and digit runs numerically', () => {
  assert.deepEqual(sortRows(['beta', 'Alpha', 'gamma'], (s) => s, 'asc'), ['Alpha', 'beta', 'gamma']);
  // Discord IDs are digit strings longer than Number can hold exactly.
  assert.deepEqual(
    sortRows(['680873189106384900', '1054500338947858522', '99'], (s) => s, 'asc'),
    ['99', '680873189106384900', '1054500338947858522'],
  );
});

test('sortRows puts null and undefined last in both directions', () => {
  const rows = [{ v: 2 }, { v: null }, { v: 1 }, { v: undefined }];
  assert.deepEqual(sortRows(rows, (r) => r.v, 'asc').map((r) => r.v), [1, 2, null, undefined]);
  assert.deepEqual(sortRows(rows, (r) => r.v, 'desc').map((r) => r.v), [2, 1, null, undefined]);
});

test('sortRows is stable and does not mutate its input', () => {
  const rows = [{ id: 'a', v: 1 }, { id: 'b', v: 0 }, { id: 'c', v: 1 }];
  const sorted = sortRows(rows, (r) => r.v, 'desc');
  assert.deepEqual(sorted.map((r) => r.id), ['a', 'c', 'b']);
  assert.deepEqual(rows.map((r) => r.id), ['a', 'b', 'c']);
});

test('applySort only accepts sortable columns and returns the effective state', () => {
  const columns: Column<{ n: number; s: string }>[] = [
    { key: 'n', label: 'N', value: (r) => r.n, defaultDir: 'desc' },
    { key: 's', label: 'S', value: (r) => r.s },
    { key: 'link', label: 'Link' },
  ];
  const rows = [{ n: 1, s: 'b' }, { n: 2, s: 'a' }];
  const fallback = { key: 'n', dir: 'desc' } as const;

  assert.deepEqual(applySort(rows, columns, 's', fallback), { rows: [{ n: 2, s: 'a' }, { n: 1, s: 'b' }], state: { key: 's', dir: 'asc' } });
  assert.deepEqual(applySort(rows, columns, undefined, fallback).rows.map((r) => r.n), [2, 1]);
  // 'link' has no value accessor, so it is not a sortable key.
  assert.deepEqual(applySort(rows, columns, 'link', fallback).state, fallback);
});
