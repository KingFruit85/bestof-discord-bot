import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageWindow, paginate, parsePage } from '../lib/paginate';

const rows = Array.from({ length: 53 }, (_, i) => i + 1);

test('paginate returns the requested page and the page count', () => {
  const first = paginate(rows, 1, 25);
  assert.deepEqual(first.rows, rows.slice(0, 25));
  assert.equal(first.page, 1);
  assert.equal(first.pageCount, 3);
  assert.equal(first.start, 1);
  assert.equal(first.end, 25);

  const last = paginate(rows, 3, 25);
  assert.deepEqual(last.rows, [51, 52, 53]);
  assert.equal(last.start, 51);
  assert.equal(last.end, 53);
});

test('paginate clamps out-of-range pages', () => {
  assert.equal(paginate(rows, 99, 25).page, 3);
  assert.equal(paginate(rows, 0, 25).page, 1);
});

test('paginate handles no rows as a single empty page', () => {
  const empty = paginate([], 2, 25);
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.page, 1);
  assert.equal(empty.pageCount, 1);
  assert.equal(empty.start, 0);
  assert.equal(empty.end, 0);
});

test('parsePage reads a positive integer and defaults to 1', () => {
  assert.equal(parsePage('3'), 3);
  assert.equal(parsePage(undefined), 1);
  assert.equal(parsePage('0'), 1);
  assert.equal(parsePage('-2'), 1);
  assert.equal(parsePage('2.5'), 1);
  assert.equal(parsePage('abc'), 1);
});

test('pageWindow shows first, last, and neighbours, with gaps as null', () => {
  assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(pageWindow(1, 15), [1, 2, null, 15]);
  assert.deepEqual(pageWindow(7, 15), [1, null, 6, 7, 8, null, 15]);
  assert.deepEqual(pageWindow(15, 15), [1, null, 14, 15]);
  assert.deepEqual(pageWindow(3, 15), [1, 2, 3, 4, null, 15]);
});
