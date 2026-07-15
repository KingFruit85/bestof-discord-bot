import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Collection, type Attachment, type Embed } from 'discord.js';
import {
  buildContextOptionLabel,
  buildContextSelectMenuOptions,
  MAX_CONTEXT_CANDIDATES,
  MAX_CONTEXT_SELECTIONS,
} from '../src/features/nominations/context-picker.js';

function fakeAttachment(overrides: Partial<Attachment>): Attachment {
  return {
    name: 'file',
    url: 'https://cdn.discordapp.com/attachments/1/2/file',
    contentType: 'application/octet-stream',
    ...overrides,
  } as Attachment;
}

function fakeCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: '123',
    content: 'hello world',
    attachments: new Collection<string, Attachment>(),
    embeds: [] as Embed[],
    author: { displayName: 'Tester' },
    ...overrides,
  } as any;
}

test('text messages are labeled with author and content', () => {
  const label = buildContextOptionLabel(fakeCandidate({ content: 'hello world' }));
  assert.equal(label, 'Tester: hello world');
});

test('image-only messages fall back to [image]', () => {
  const attachments = new Collection<string, Attachment>();
  attachments.set('1', fakeAttachment({ contentType: 'image/png' }));
  const label = buildContextOptionLabel(fakeCandidate({ content: '', attachments }));
  assert.equal(label, 'Tester: [image]');
});

test('video-only messages fall back to [video]', () => {
  const attachments = new Collection<string, Attachment>();
  attachments.set('1', fakeAttachment({ contentType: 'video/mp4' }));
  const label = buildContextOptionLabel(fakeCandidate({ content: '', attachments }));
  assert.equal(label, 'Tester: [video]');
});

test('audio-only messages fall back to [audio]', () => {
  const attachments = new Collection<string, Attachment>();
  attachments.set('1', fakeAttachment({ contentType: 'audio/ogg' }));
  const label = buildContextOptionLabel(fakeCandidate({ content: '', attachments }));
  assert.equal(label, 'Tester: [audio]');
});

test('other attachment types fall back to [attachment]', () => {
  const attachments = new Collection<string, Attachment>();
  attachments.set('1', fakeAttachment({ contentType: 'application/pdf' }));
  const label = buildContextOptionLabel(fakeCandidate({ content: '', attachments }));
  assert.equal(label, 'Tester: [attachment]');
});

test('embed-only messages (e.g. link unfurls) fall back to [embed]', () => {
  const label = buildContextOptionLabel(
    fakeCandidate({ content: '', embeds: [{ data: {} }] as Embed[] })
  );
  assert.equal(label, 'Tester: [embed]');
});

test('messages with no text, attachments, or embeds fall back to [message]', () => {
  const label = buildContextOptionLabel(fakeCandidate({ content: '' }));
  assert.equal(label, 'Tester: [message]');
});

test('long labels are truncated to fit Discord select-option limits', () => {
  const longContent = 'x'.repeat(200);
  const label = buildContextOptionLabel(fakeCandidate({ content: longContent }));
  assert.equal(label.length, 100);
  assert.ok(label.endsWith('…'));
});

test('labels exactly at the 100-char limit are not truncated', () => {
  // 'Tester: ' is 8 chars, so 92 more chars lands exactly on the limit.
  const content = 'x'.repeat(92);
  const label = buildContextOptionLabel(fakeCandidate({ content }));
  assert.equal(label.length, 100);
  assert.ok(!label.endsWith('…'));
});

test('emoji-heavy labels are truncated on code-point boundaries, not mid-surrogate-pair', () => {
  const emoji = '😀'; // U+1F600, a surrogate pair in UTF-16
  const longContent = emoji.repeat(150);
  const label = buildContextOptionLabel(fakeCandidate({ content: longContent }));

  assert.ok(label.endsWith('…'));
  assert.ok(!label.includes('�'));

  // A lone surrogate encodes/decodes lossily (produces the replacement
  // character); round-tripping confirms every surrogate is still paired.
  const roundTripped = new TextDecoder().decode(new TextEncoder().encode(label));
  assert.equal(roundTripped, label);
});

test('regression: a label under 100 code points but over 100 UTF-16 units is still truncated to fit Discord\'s actual limit', () => {
  // 68 code points ('Tester: ' + 60 emoji) but 128 UTF-16 units, since each
  // emoji is a 2-unit surrogate pair. A code-point-only length check (the
  // prior, buggy implementation) would wrongly treat this as short enough
  // and skip truncation entirely, causing Discord's API to reject the
  // select-menu option with a real length > 100 — this is exactly what
  // happened in production when a bot-authored greeting message (containing
  // 🔥/🏆 emoji) was picked up as a context-picker candidate.
  const emoji = '🔥'; // U+1F525, a surrogate pair in UTF-16
  const content = emoji.repeat(60);
  const label = buildContextOptionLabel(fakeCandidate({ content }));

  assert.ok(Array.from(`Tester: ${content}`).length <= 100, 'sanity check: code-point count is under 100');
  assert.ok(`Tester: ${content}`.length > 100, 'sanity check: UTF-16 length is over 100');
  assert.ok(label.length <= 100, `label UTF-16 length must be <= 100, got ${label.length}`);
});

test('buildContextSelectMenuOptions maps each message to a label/value pair keyed by message id', () => {
  const messages = [fakeCandidate({ id: 'a', content: 'first' }), fakeCandidate({ id: 'b', content: 'second' })];
  const options = buildContextSelectMenuOptions(messages);
  assert.deepEqual(options, [
    { label: 'Tester: first', value: 'a' },
    { label: 'Tester: second', value: 'b' },
  ]);
});

test('exports the agreed candidate and selection caps', () => {
  assert.equal(MAX_CONTEXT_CANDIDATES, 10);
  assert.equal(MAX_CONTEXT_SELECTIONS, 3);
});

test('buildContextSelectMenuOptions returns an empty array for no messages', () => {
  assert.deepEqual(buildContextSelectMenuOptions([]), []);
});
