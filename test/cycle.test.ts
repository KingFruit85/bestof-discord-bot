import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESET_THRESHOLD, shouldStartNewCycle } from '../src/features/scheduling/cycle.js';

test('the default threshold is 90%', () => {
  assert.equal(RESET_THRESHOLD, 0.9);
});

test('does not reset below the threshold', () => {
  // The daily server on 2026-11-07: 308 / 352 = 87.5%.
  assert.equal(shouldStartNewCycle({ total: 352, posted: 308, skipped: 0 }), false);
});

test('resets at and above the threshold', () => {
  assert.equal(shouldStartNewCycle({ total: 10, posted: 9, skipped: 0 }), true);
  assert.equal(shouldStartNewCycle({ total: 352, posted: 317, skipped: 0 }), true);
  assert.equal(shouldStartNewCycle({ total: 10, posted: 10, skipped: 0 }), true);
});

test('skipped nominations are excluded from the denominator', () => {
  // 300 / 352 = 85% would not reset, but 20 skips leave 332 postable: 90.4%.
  assert.equal(shouldStartNewCycle({ total: 352, posted: 300, skipped: 0 }), false);
  assert.equal(shouldStartNewCycle({ total: 352, posted: 300, skipped: 20 }), true);
});

test('never resets when nothing is postable or nothing has been posted', () => {
  assert.equal(shouldStartNewCycle({ total: 0, posted: 0, skipped: 0 }), false);
  assert.equal(shouldStartNewCycle({ total: 5, posted: 0, skipped: 5 }), false);
  assert.equal(shouldStartNewCycle({ total: 5, posted: 0, skipped: 0 }), false);
});

test('accepts a custom threshold', () => {
  assert.equal(shouldStartNewCycle({ total: 10, posted: 5, skipped: 0 }, 0.5), true);
  assert.equal(shouldStartNewCycle({ total: 10, posted: 4, skipped: 0 }, 0.5), false);
});
