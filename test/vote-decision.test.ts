import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideVoteAction, activeSourceOf, type Vote } from '../src/features/voting/queries.js';

function fakeVote(overrides: Partial<Vote>): Vote {
  return {
    id: 1,
    nomination_id: 1,
    voter_id: '1',
    vote_value: 1,
    source: 'button',
    created_at: new Date(),
    ...overrides,
  };
}

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

test('activeSourceOf returns null when there is no vote', () => {
  assert.equal(activeSourceOf(null), null);
});

test('activeSourceOf returns the source of an active (non-zero) vote', () => {
  assert.equal(activeSourceOf(fakeVote({ source: 'button', vote_value: 1 })), 'button');
  assert.equal(activeSourceOf(fakeVote({ source: 'reaction', vote_value: -1 })), 'reaction');
});

test('activeSourceOf returns null for a withdrawn (zeroed-out) vote, regardless of its stale source', () => {
  assert.equal(activeSourceOf(fakeVote({ source: 'reaction', vote_value: 0 })), null);
  assert.equal(activeSourceOf(fakeVote({ source: 'button', vote_value: 0 })), null);
});

test('regression: after a reaction vote is withdrawn, the other method is free to claim the vote', () => {
  const withdrawnReactionVote = fakeVote({ source: 'reaction', vote_value: 0 });
  assert.equal(decideVoteAction(activeSourceOf(withdrawnReactionVote), 'button'), 'insert');
});
