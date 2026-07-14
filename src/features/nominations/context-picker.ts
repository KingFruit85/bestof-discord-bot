import type { Attachment, Collection, Embed } from 'discord.js';

export const MAX_CONTEXT_CANDIDATES = 10;
export const MAX_CONTEXT_SELECTIONS = 3;
const OPTION_LABEL_MAX_LENGTH = 100;

export interface ContextCandidate {
  id: string;
  content: string;
  attachments: Collection<string, Attachment>;
  embeds: Embed[];
  author: { displayName: string };
}

function describeMessageContent(message: ContextCandidate): string {
  if (message.content) return message.content;

  const attachment = message.attachments.first();
  if (attachment) {
    if (attachment.contentType?.startsWith('image/')) return '[image]';
    if (attachment.contentType?.startsWith('video/')) return '[video]';
    if (attachment.contentType?.startsWith('audio/')) return '[audio]';
    return '[attachment]';
  }

  if (message.embeds.length > 0) return '[embed]';

  return '[message]';
}

export function buildContextOptionLabel(message: ContextCandidate): string {
  const label = `${message.author.displayName}: ${describeMessageContent(message)}`;
  const codePoints = Array.from(label);
  if (codePoints.length <= OPTION_LABEL_MAX_LENGTH) return label;

  // Slice on code points (not raw UTF-16 code units) so we never bisect a
  // surrogate pair — doing so would produce an unpaired surrogate that
  // renders as U+FFFD (the replacement character glyph) once encoded.
  return `${codePoints.slice(0, OPTION_LABEL_MAX_LENGTH - 1).join('')}…`;
}

export function buildContextSelectMenuOptions(
  messages: ContextCandidate[]
): { label: string; value: string }[] {
  return messages.map((message) => ({
    label: buildContextOptionLabel(message),
    value: message.id,
  }));
}
