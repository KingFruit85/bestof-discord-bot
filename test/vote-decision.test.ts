import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideVoteAction } from '../src/features/voting/queries.js';

test('inserts when there is no existing vote', () => {
  assert.equal(decideVoteAction(null, 'button'), 'insert');
  assert.equal(decideVoteAction(null, 'reaction'), 'insert');
});

test('updates when the existing vote has the same source', () => {
  assert.equal(decideVoteAction('button', 'button'), 'update');
  assert.equal(decideVoteAction('reaction', 'reaction'), 'update');
});

test('ignores when the existing vote has a different source (first-method-wins)', () => {
  assert.equal(decideVoteAction('button', 'reaction'), 'ignore');
  assert.equal(decideVoteAction('reaction', 'button'), 'ignore');
});
