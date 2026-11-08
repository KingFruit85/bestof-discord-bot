import { test } from 'node:test';
import assert from 'node:assert/strict';
import { axisMid, barShare, fillMonths, monthLabel, niceMax } from '../lib/chart';

test('fillMonths zero-fills gaps from the first month through the end month', () => {
  const filled = fillMonths(
    [
      { month: '2024-11', count: 3 },
      { month: '2025-02', count: 2 },
    ],
    '2025-03',
  );
  assert.deepEqual(filled, [
    { month: '2024-11', count: 3 },
    { month: '2024-12', count: 0 },
    { month: '2025-01', count: 0 },
    { month: '2025-02', count: 2 },
    { month: '2025-03', count: 0 },
  ]);
});

test('fillMonths returns nothing for no data', () => {
  assert.deepEqual(fillMonths([], '2025-03'), []);
});

test('niceMax rounds up to a clean axis top: 1, 2, 3, 4, 5, 6, 8, or 10 times a power of ten', () => {
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(1), 1);
  assert.equal(niceMax(3), 3);
  assert.equal(niceMax(7), 8);
  assert.equal(niceMax(22), 30);
  assert.equal(niceMax(48), 50);
  assert.equal(niceMax(51), 60);
  assert.equal(niceMax(120), 200);
});

test('axisMid labels the halfway gridline only when it is a whole number', () => {
  assert.equal(axisMid(30), 15);
  assert.equal(axisMid(3), null);
  assert.equal(axisMid(1), null);
});

test('barShare is value over max, clamped to 0..1', () => {
  assert.equal(barShare(5, 10), 0.5);
  assert.equal(barShare(10, 10), 1);
  assert.equal(barShare(-2, 10), 0);
  assert.equal(barShare(3, 0), 0);
});

test('monthLabel formats a YYYY-MM month', () => {
  assert.equal(monthLabel('2025-05'), 'May 2025');
  assert.equal(monthLabel('2023-12'), 'Dec 2023');
});
