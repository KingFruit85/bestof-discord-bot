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

  // Discord validates the option label's raw UTF-16 `.length`, not its
  // code-point count — a code-point count under the limit is NOT sufficient
  // (astral characters like many emoji are 2 UTF-16 units but 1 code point,
  // so a label can pass a code-point check while still exceeding Discord's
  // actual length limit). Build the truncated string one code point at a
  // time, tracking UTF-16 length directly, so we both respect the real
  // limit and never bisect a surrogate pair (which would leave a lone
  // surrogate that renders as U+FFFD once encoded).
  if (label.length <= OPTION_LABEL_MAX_LENGTH) return label;

  let truncated = '';
  for (const char of label) {
    if (truncated.length + char.length > OPTION_LABEL_MAX_LENGTH - 1) break;
    truncated += char;
  }
  return `${truncated}…`;
}

export function buildContextSelectMenuOptions(
  messages: ContextCandidate[]
): { label: string; value: string }[] {
  return messages.map((message) => ({
    label: buildContextOptionLabel(message),
    value: message.id,
  }));
}
