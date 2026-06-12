import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPostableNomination } from '../src/features/scheduling/picker.js';

interface FakeNomination {
  id: number;
  message_link: string;
}

function nom(id: number): FakeNomination {
  return { id, message_link: `https://discord.com/channels/1/2/${id}` };
}

/**
 * Builds picker deps backed by a scripted candidate queue.
 * - `candidates`: values returned by successive getCandidate calls (null = pool exhausted)
 * - `deadLinks`: message links whose fetch throws (message deleted)
 */
function makeDeps(candidates: (FakeNomination | null)[], deadLinks: string[] = []) {
  const queue = [...candidates];
  const marked: string[] = [];
  let resets = 0;

  return {
    deps: {
      getCandidate: async () => queue.shift() ?? null,
      resetHistory: async () => {
        resets++;
      },
      fetchMessage: async (link: string) => {
        if (deadLinks.includes(link)) throw new Error('Unknown Message');
        return { link };
      },
      markUnpostable: async (link: string) => {
        marked.push(link);
      },
    },
    marked,
    getResets: () => resets,
  };
}

test('returns the first candidate whose message can be fetched', async () => {
  const a = nom(1);
  const { deps, marked, getResets } = makeDeps([a]);

  const result = await pickPostableNomination(deps);

  assert.equal(result?.nomination, a);
  assert.deepEqual(result?.message, { link: a.message_link });
  assert.deepEqual(marked, []);
  assert.equal(getResets(), 0);
});

test('marks unfetchable candidates as unpostable and tries the next one', async () => {
  const dead = nom(1);
  const alive = nom(2);
  const { deps, marked } = makeDeps([dead, alive], [dead.message_link]);

  const result = await pickPostableNomination(deps);

  assert.equal(result?.nomination, alive);
  assert.deepEqual(marked, [dead.message_link]);
});

test('resets history once when the pool is exhausted, then retries', async () => {
  const a = nom(1);
  const { deps, getResets } = makeDeps([null, a]);

  const result = await pickPostableNomination(deps);

  assert.equal(result?.nomination, a);
  assert.equal(getResets(), 1);
});

test('returns null when there are no nominations at all', async () => {
  const { deps, getResets } = makeDeps([null, null]);

  const result = await pickPostableNomination(deps);

  assert.equal(result, null);
  assert.equal(getResets(), 1);
});

test('never resets history more than once per invocation', async () => {
  const dead = nom(1);
  // exhausted -> reset -> dead candidate marked -> exhausted again -> give up
  const { deps, marked, getResets } = makeDeps([null, dead, null], [dead.message_link]);

  const result = await pickPostableNomination(deps);

  assert.equal(result, null);
  assert.deepEqual(marked, [dead.message_link]);
  assert.equal(getResets(), 1);
});

test('gives up after maxAttempts when every candidate is dead', async () => {
  const deadNoms = [nom(1), nom(2), nom(3), nom(4), nom(5)];
  const { deps, marked } = makeDeps(
    deadNoms,
    deadNoms.map(n => n.message_link)
  );

  const result = await pickPostableNomination({ ...deps, maxAttempts: 3 });

  assert.equal(result, null);
  assert.equal(marked.length, 3);
});
