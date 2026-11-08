import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backfillAuthors, type AuthorLookup } from '../src/features/nominations/backfill.js';

const link = (id: number) => `https://discord.com/channels/1/2/${id}`;

test('saves each found author and tallies what could not be resolved', async () => {
  const saved: [number, string][] = [];
  const lookups: Record<string, AuthorLookup> = {
    '10': { status: 'found', authorId: 'alice' },
    '11': { status: 'missing' },
    '12': { status: 'found', authorId: 'bob' },
  };
  const summary = await backfillAuthors(
    [
      { id: 1, message_link: link(10) },
      { id: 2, message_link: link(11) },
      { id: 3, message_link: 'garbage' },
      { id: 4, message_link: link(12) },
    ],
    {
      lookupAuthor: async (ref) => lookups[ref.messageId]!,
      saveAuthor: async (id, authorId) => {
        saved.push([id, authorId]);
      },
    },
  );
  assert.deepEqual(saved, [
    [1, 'alice'],
    [4, 'bob'],
  ]);
  assert.deepEqual(summary, { found: 2, missing: 1, invalidLink: 1, failed: 0 });
});

test('a lookup error is counted as failed and does not stop the run', async () => {
  const saved: number[] = [];
  const summary = await backfillAuthors(
    [
      { id: 1, message_link: link(10) },
      { id: 2, message_link: link(11) },
    ],
    {
      lookupAuthor: async (ref) => {
        if (ref.messageId === '10') throw new Error('network down');
        return { status: 'found', authorId: 'carol' };
      },
      saveAuthor: async (id) => {
        saved.push(id);
      },
    },
  );
  assert.deepEqual(saved, [2]);
  assert.deepEqual(summary, { found: 1, missing: 0, invalidLink: 0, failed: 1 });
});

test('dry run looks authors up without saving', async () => {
  let saves = 0;
  const summary = await backfillAuthors([{ id: 1, message_link: link(10) }], {
    lookupAuthor: async () => ({ status: 'found', authorId: 'dave' }),
    saveAuthor: async () => {
      saves++;
    },
    dryRun: true,
  });
  assert.equal(saves, 0);
  assert.deepEqual(summary, { found: 1, missing: 0, invalidLink: 0, failed: 0 });
});
