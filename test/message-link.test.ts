import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMessageLink } from '../src/shared/message-link.js';

test('parses a Discord message link into its IDs', () => {
  assert.deepEqual(parseMessageLink('https://discord.com/channels/680873189106384900/680873189106384988/1234567890123456789'), {
    guildId: '680873189106384900',
    channelId: '680873189106384988',
    messageId: '1234567890123456789',
  });
});

test('accepts canary, ptb, and legacy discordapp.com hosts', () => {
  for (const host of ['canary.discord.com', 'ptb.discord.com', 'discordapp.com']) {
    assert.equal(parseMessageLink(`https://${host}/channels/1/2/3`)?.messageId, '3');
  }
});

test('rejects anything that is not a message link', () => {
  assert.equal(parseMessageLink('not a url'), null);
  assert.equal(parseMessageLink('https://discord.com/channels/1/2'), null);
  assert.equal(parseMessageLink('https://example.com/channels/1/2/3'), null);
  assert.equal(parseMessageLink('https://discord.com/channels/1/2/abc'), null);
});
