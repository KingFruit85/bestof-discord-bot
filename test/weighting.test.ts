import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_AGE_DAYS, pickWeighted, waitStart, waitWeight } from '../src/features/scheduling/weighting.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-11T08:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

test('the minimum age is 30 days', () => {
  assert.equal(MIN_AGE_DAYS, 30);
});

test('a nomination starts to wait when it reaches the minimum age', () => {
  const created_at = daysAgo(100);
  assert.deepEqual(waitStart({ created_at, waiting_since: null }), daysAgo(70));
});

test('a recorded waiting_since overrides the minimum age', () => {
  assert.deepEqual(waitStart({ created_at: daysAgo(400), waiting_since: daysAgo(5) }), daysAgo(5));
});

test('weight is 1 on the first day of waiting, plus 1 per full day', () => {
  assert.equal(waitWeight({ created_at: daysAgo(30), waiting_since: null }, NOW), 1);
  assert.equal(waitWeight({ created_at: daysAgo(31), waiting_since: null }, NOW), 2);
  assert.equal(waitWeight({ created_at: daysAgo(0), waiting_since: daysAgo(100) }, NOW), 101);
});

test('weight counts part days', () => {
  assert.equal(waitWeight({ created_at: daysAgo(30.5), waiting_since: null }, NOW), 1.5);
});

test('weight never drops below 1, even if waiting starts in the future', () => {
  assert.equal(waitWeight({ created_at: daysAgo(10), waiting_since: null }, NOW), 1);
  assert.equal(waitWeight({ created_at: daysAgo(0), waiting_since: daysAgo(-1) }, NOW), 1);
});

test('pickWeighted returns null for an empty pool', () => {
  assert.equal(pickWeighted([], () => 1, () => 0.5), null);
});

test('pickWeighted picks by cumulative weight', () => {
  const items = [{ id: 'a', w: 1 }, { id: 'b', w: 3 }];
  const pick = (r: number) => pickWeighted(items, (i) => i.w, () => r)?.id;
  assert.equal(pick(0), 'a');
  assert.equal(pick(0.2499), 'a');
  assert.equal(pick(0.25), 'b');
  assert.equal(pick(0.9999), 'b');
});

test('pickWeighted gives each item a chance in proportion to its weight', () => {
  const items = [{ id: 'old', w: 101 }, { id: 'new', w: 2 }];
  const counts = { old: 0, new: 0 };
  const steps = 10_300;
  for (let i = 0; i < steps; i++) {
    const picked = pickWeighted(items, (x) => x.w, () => i / steps);
    counts[picked!.id as 'old' | 'new']++;
  }
  assert.equal(counts.old, 10_100);
  assert.equal(counts.new, 200);
});
