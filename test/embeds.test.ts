import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Collection, type Message, type Attachment, type Embed } from 'discord.js';
import { EmbedHelper } from '../src/shared/embeds.js';

function fakeAttachment(overrides: Partial<Attachment>): Attachment {
  return {
    name: 'file',
    url: 'https://cdn.discordapp.com/attachments/1/2/file',
    contentType: 'application/octet-stream',
    size: 1024,
    ...overrides,
  } as Attachment;
}

function fakeMessage(overrides: Partial<Record<keyof Message, unknown>> = {}): Message {
  return {
    reference: null,
    content: 'hello world',
    createdTimestamp: 1700000000000,
    url: 'https://discord.com/channels/1/2/3',
    author: {
      displayName: 'Tester',
      displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/1/a.png',
    },
    attachments: new Collection<string, Attachment>(),
    embeds: [] as Embed[],
    ...overrides,
  } as unknown as Message;
}

test('image attachments are attached and referenced by the embed (regression)', async () => {
  const attachments = new Collection<string, Attachment>();
  attachments.set('1', fakeAttachment({ name: 'pic.png', contentType: 'image/png' }));
  const message = fakeMessage({ attachments });

  const { embeds, files } = await EmbedHelper.createNominationEmbeds(message);

  assert.equal(files?.length, 1);
  // lead embed is second-to-last (tail embed is always last)
  const lead = embeds[embeds.length - 2]!;
  assert.equal(lead.data.image?.url, 'attachment://pic.png');
});

test('video attachments are attached so Discord renders a player', async () => {
  const attachments = new Collection<string, Attachment>();
  attachments.set(
    '1',
    fakeAttachment({
      name: 'clip.mp4',
      contentType: 'video/mp4',
      url: 'https://cdn.discordapp.com/attachments/1/2/clip.mp4',
      size: 5 * 1024 * 1024,
    })
  );
  const message = fakeMessage({ attachments });

  const { files, videoUrls } = await EmbedHelper.createNominationEmbeds(message);

  assert.equal(files?.length, 1);
  assert.deepEqual(videoUrls, []);
});

test('oversized video attachments fall back to a CDN link in videoUrls', async () => {
  const attachments = new Collection<string, Attachment>();
  attachments.set(
    '1',
    fakeAttachment({
      name: 'big.mp4',
      contentType: 'video/mp4',
      url: 'https://cdn.discordapp.com/attachments/1/2/big.mp4',
      size: 50 * 1024 * 1024,
    })
  );
  const message = fakeMessage({ attachments });

  const { files, videoUrls } = await EmbedHelper.createNominationEmbeds(message);

  assert.equal(files?.length, 0);
  assert.deepEqual(videoUrls, ['https://cdn.discordapp.com/attachments/1/2/big.mp4']);
});

test('embedded video links (e.g. YouTube) are surfaced in videoUrls for content unfurling', async () => {
  const message = fakeMessage({
    content: 'check this out https://www.youtube.com/watch?v=abc123',
    embeds: [
      {
        data: {
          url: 'https://www.youtube.com/watch?v=abc123',
          video: { url: 'https://www.youtube.com/embed/abc123' },
        },
      },
    ] as Embed[],
  });

  const { videoUrls } = await EmbedHelper.createNominationEmbeds(message);

  assert.deepEqual(videoUrls, ['https://www.youtube.com/watch?v=abc123']);
});

test('text-only messages produce no files and no video urls', async () => {
  const message = fakeMessage();

  const { files, videoUrls } = await EmbedHelper.createNominationEmbeds(message);

  assert.equal(files?.length, 0);
  assert.deepEqual(videoUrls, []);
});
