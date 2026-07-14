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
  return label.length > OPTION_LABEL_MAX_LENGTH
    ? `${label.slice(0, OPTION_LABEL_MAX_LENGTH - 1)}…`
    : label;
}

export function buildContextSelectMenuOptions(
  messages: ContextCandidate[]
): { label: string; value: string }[] {
  return messages.map((message) => ({
    label: buildContextOptionLabel(message),
    value: message.id,
  }));
}
