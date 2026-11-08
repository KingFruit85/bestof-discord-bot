import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRateGate,
  DiscordLookupError,
  avatarUrl,
  displayName,
  userProfile,
  fetchDiscord,
  mapWithConcurrency,
  resolveNames,
  type FetchLike,
} from '../lib/discord';

function response(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return {
    status,
    json: async () => body,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  };
}

/** A fake fetch that replays scripted responses and records each request. */
function fakeFetch(...responses: ReturnType<typeof response>[]) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers });
    const next = responses.shift();
    if (!next) throw new Error('unexpected extra request');
    return next;
  };
  return { fetch, calls };
}

const noSleep = async () => {};

test('displayName prefers the global display name', () => {
  assert.equal(displayName({ username: 'kingfruit', global_name: 'King Fruit' }), 'King Fruit');
  assert.equal(displayName({ username: 'kingfruit', global_name: null }), 'kingfruit');
  assert.equal(displayName({ username: 'kingfruit', global_name: '   ' }), 'kingfruit');
});

test('avatarUrl uses the custom avatar hash as a small static webp', () => {
  assert.equal(
    avatarUrl({ id: '80351110224678912', avatar: '8342729096ea3675442027381ff50dfe', discriminator: '0' }),
    'https://cdn.discordapp.com/avatars/80351110224678912/8342729096ea3675442027381ff50dfe.webp?size=64',
  );
  // Animated avatars (a_ prefix) still get a static webp: the first frame.
  assert.match(avatarUrl({ id: '1', avatar: 'a_abc', discriminator: '0' }), /\/avatars\/1\/a_abc\.webp\?size=64$/);
});

test('avatarUrl falls back to the default avatar Discord derives from the user', () => {
  // New username system: (id >> 22) % 6.
  assert.equal(
    avatarUrl({ id: '80351110224678912', avatar: null, discriminator: '0' }),
    `https://cdn.discordapp.com/embed/avatars/${Number((80351110224678912n >> 22n) % 6n)}.png`,
  );
  // Legacy discriminators: discriminator % 5.
  assert.equal(
    avatarUrl({ id: '80351110224678912', avatar: null, discriminator: '1337' }),
    'https://cdn.discordapp.com/embed/avatars/2.png',
  );
});

test('userProfile combines the display name and avatar', () => {
  assert.deepEqual(
    userProfile({ id: '1', username: 'kingfruit', global_name: 'King Fruit', avatar: 'abc', discriminator: '0' }),
    { name: 'King Fruit', avatar: 'https://cdn.discordapp.com/avatars/1/abc.webp?size=64' },
  );
});

test('fetchDiscord sends bot auth and returns the body on 200', async () => {
  const { fetch, calls } = fakeFetch(response(200, { id: '1', name: 'NorDev' }));
  const guild = await fetchDiscord<{ name: string }>('/guilds/1', { fetch, token: 'tok', sleep: noSleep });
  assert.deepEqual(guild, { id: '1', name: 'NorDev' });
  assert.equal(calls[0]?.url, 'https://discord.com/api/v10/guilds/1');
  assert.equal(calls[0]?.headers.Authorization, 'Bot tok');
  assert.match(calls[0]?.headers['User-Agent'] ?? '', /^DiscordBot \(/);
});

test('fetchDiscord returns null on 404 so "unknown" can be cached', async () => {
  const { fetch } = fakeFetch(response(404));
  assert.equal(await fetchDiscord('/users/1', { fetch, token: 't', sleep: noSleep }), null);
});

test('fetchDiscord waits and retries once on a short 429', async () => {
  const slept: number[] = [];
  const { fetch, calls } = fakeFetch(response(429, { retry_after: 0.5 }), response(200, { id: '1' }));
  const user = await fetchDiscord('/users/1', { fetch, token: 't', sleep: async (ms) => void slept.push(ms) });
  assert.deepEqual(user, { id: '1' });
  assert.deepEqual(slept, [500]);
  assert.equal(calls.length, 2);
});

test('fetchDiscord throws without waiting on a long 429, so the failure is not cached', async () => {
  const slept: number[] = [];
  const { fetch, calls } = fakeFetch(response(429, { retry_after: 30 }));
  await assert.rejects(
    fetchDiscord('/users/1', { fetch, token: 't', sleep: async (ms) => void slept.push(ms) }),
    DiscordLookupError,
  );
  assert.deepEqual(slept, []);
  assert.equal(calls.length, 1);
});

test('fetchDiscord throws when a retry is rate limited again', async () => {
  const { fetch, calls } = fakeFetch(response(429, { retry_after: 0.1 }), response(429, { retry_after: 0.1 }));
  await assert.rejects(fetchDiscord('/users/1', { fetch, token: 't', sleep: noSleep }), DiscordLookupError);
  assert.equal(calls.length, 2);
});

test('fetchDiscord falls back to the Retry-After header when the body has no retry_after', async () => {
  const slept: number[] = [];
  const { fetch } = fakeFetch(response(429, {}, { 'retry-after': '1' }), response(200, { id: '1' }));
  await fetchDiscord('/users/1', { fetch, token: 't', sleep: async (ms) => void slept.push(ms) });
  assert.deepEqual(slept, [1000]);
});

test('fetchDiscord throws on server errors and bad tokens', async () => {
  await assert.rejects(fetchDiscord('/users/1', { fetch: fakeFetch(response(500)).fetch, token: 't', sleep: noSleep }), DiscordLookupError);
  await assert.rejects(fetchDiscord('/users/1', { fetch: fakeFetch(response(401)).fetch, token: 't', sleep: noSleep }), DiscordLookupError);
});

test('mapWithConcurrency keeps order and never exceeds the limit', async () => {
  let active = 0;
  let peak = 0;
  const results = await mapWithConcurrency([5, 1, 4, 2, 3, 0], 2, async (n) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, n));
    active--;
    return n * 10;
  });
  assert.deepEqual(results, [50, 10, 40, 20, 30, 0]);
  assert.equal(peak, 2);
});

test('resolveNames dedupes IDs and leaves out unknown or failed lookups', async () => {
  const looked: string[] = [];
  const names = await resolveNames(['a', 'b', 'a', 'c', 'd'], 2, async (id) => {
    looked.push(id);
    if (id === 'c') return null;
    if (id === 'd') throw new Error('rate limited');
    return id.toUpperCase();
  });
  assert.deepEqual(names, { a: 'A', b: 'B' });
  assert.deepEqual(looked.sort(), ['a', 'b', 'c', 'd']);
});

test('a rate gate stops lookups once the remaining allowance reaches the reserve, until the window resets', async () => {
  let now = 1_000_000;
  const gate = createRateGate();
  const { fetch, calls } = fakeFetch(
    response(200, { id: '1' }, { 'x-ratelimit-remaining': '6', 'x-ratelimit-reset-after': '10' }),
    response(200, { id: '2' }, { 'x-ratelimit-remaining': '5', 'x-ratelimit-reset-after': '9.5' }),
    response(200, { id: '4' }, { 'x-ratelimit-remaining': '29', 'x-ratelimit-reset-after': '30' }),
  );
  const deps = { fetch, token: 't', sleep: noSleep, gate, now: () => now };

  await fetchDiscord('/users/1', deps); // 6 left: above the reserve
  await fetchDiscord('/users/2', deps); // 5 left: reserve reached, gate closes for 9.5 s
  await assert.rejects(fetchDiscord('/users/3', deps), DiscordLookupError);
  assert.equal(calls.length, 2, 'a closed gate must not send a request');

  now += 9_500; // window reset
  await fetchDiscord('/users/4', deps);
  assert.equal(calls.length, 3);
});

test('a long 429 closes the gate for its retry_after', async () => {
  let now = 0;
  const gate = createRateGate();
  const { fetch, calls } = fakeFetch(response(429, { retry_after: 20 }));
  const deps = { fetch, token: 't', sleep: noSleep, gate, now: () => now };

  await assert.rejects(fetchDiscord('/users/1', deps), DiscordLookupError);
  await assert.rejects(fetchDiscord('/users/2', deps), DiscordLookupError);
  assert.equal(calls.length, 1);
  now += 20_000;
  assert.equal(gate.blockedUntil, 20_000);
});

test('responses without rate-limit headers leave the gate open', async () => {
  const gate = createRateGate();
  const { fetch } = fakeFetch(response(200, { id: '1' }), response(200, { id: '2' }));
  const deps = { fetch, token: 't', sleep: noSleep, gate, now: () => 0 };
  await fetchDiscord('/users/1', deps);
  await fetchDiscord('/users/2', deps);
  assert.equal(gate.blockedUntil, 0);
});

test('the gate counts requests still in flight, so concurrency cannot eat the reserve', async () => {
  const gate = createRateGate();
  let releaseSecond!: () => void;
  const secondDone = new Promise<void>((resolve) => (releaseSecond = resolve));
  const calls: string[] = [];
  const fetch: FetchLike = async (url) => {
    calls.push(url);
    if (url.endsWith('/2')) {
      await secondDone; // still in flight while /1's response arrives
      return response(200, { id: '2' }, { 'x-ratelimit-remaining': '5', 'x-ratelimit-reset-after': '10' });
    }
    // 6 left, but /2 is in flight and will use one: effectively 5, the reserve.
    return response(200, { id: '1' }, { 'x-ratelimit-remaining': '6', 'x-ratelimit-reset-after': '10' });
  };
  const deps = { fetch, token: 't', sleep: noSleep, gate, now: () => 0 };

  const second = fetchDiscord('/users/2', deps);
  await fetchDiscord('/users/1', deps);
  await assert.rejects(fetchDiscord('/users/3', deps), DiscordLookupError);
  releaseSecond();
  await second;
  assert.equal(calls.length, 2);
  assert.equal(gate.inFlight, 0);
});
