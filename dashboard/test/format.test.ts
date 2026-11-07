import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHref,
  firstParam,
  formatAge,
  formatDate,
  formatDateTime,
  formatPercent,
  fraction,
  isRecent,
  parseStatus,
  serverName,
} from '../lib/format';

const DAY = 86_400_000;

test('firstParam takes the first value of repeated params', () => {
  assert.equal(firstParam('a'), 'a');
  assert.equal(firstParam(['a', 'b']), 'a');
  assert.equal(firstParam(undefined), undefined);
});

test('parseStatus defaults to all', () => {
  assert.equal(parseStatus('pool'), 'pool');
  assert.equal(parseStatus(['pool']), 'pool');
  assert.equal(parseStatus('posted'), 'all');
  assert.equal(parseStatus(undefined), 'all');
});

test('fraction returns null when total is zero', () => {
  assert.equal(fraction(308, 352), 0.875);
  assert.equal(fraction(0, 0), null);
});

test('formatPercent renders one decimal place or a dash', () => {
  assert.equal(formatPercent(0.875), '87.5%');
  assert.equal(formatPercent(1), '100.0%');
  assert.equal(formatPercent(null), '—');
});

test('formatAge picks a unit by magnitude', () => {
  assert.equal(formatAge(DAY / 2), 'under a day');
  assert.equal(formatAge(DAY), '1 day');
  assert.equal(formatAge(13 * DAY), '13 days');
  assert.equal(formatAge(14 * DAY), '2 wks');
  assert.equal(formatAge(59 * DAY), '8 wks');
  assert.equal(formatAge(60 * DAY), '2 mos');
  assert.equal(formatAge(729 * DAY), '24 mos');
  assert.equal(formatAge(730 * DAY), '2 yrs');
  assert.equal(formatAge(365 * DAY * 3 + DAY), '3 yrs');
});

test('isRecent is true strictly inside the window', () => {
  const posted = new Date('2026-11-07T09:00:00Z');
  assert.equal(isRecent(posted, new Date(posted.getTime() - 89 * DAY)), true);
  assert.equal(isRecent(posted, new Date(posted.getTime() - 90 * DAY)), false);
  assert.equal(isRecent(posted, new Date('2023-11-03T00:00:00Z')), false);
});

test('serverName falls back to the raw ID', () => {
  assert.equal(serverName('1', { '1': 'Daily' }), 'Daily');
  assert.equal(serverName('9', { '1': 'Daily' }), '9');
});

test('formatDate and formatDateTime render in UTC', () => {
  const d = new Date('2026-11-07T23:30:00Z');
  assert.equal(formatDate(d), '7 Nov 2026');
  assert.equal(formatDateTime(d), '7 Nov 2026, 23:30 UTC');
});

test('buildHref merges overrides and drops empty values', () => {
  assert.equal(buildHref({}, {}), '/');
  assert.equal(buildHref({ guild: '1', sort: 'score' }, { status: 'pool' }), '/?guild=1&sort=score&status=pool');
  assert.equal(buildHref({ guild: '1', status: 'pool' }, { status: undefined }), '/?guild=1');
});
