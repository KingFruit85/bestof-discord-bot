/**
 * Fills nominations.author_id for nominations made before the bot recorded
 * authors, by fetching each nominated message from Discord.
 *
 *   npm run backfill-authors -- --dry-run   # look up only, write nothing
 *   npm run backfill-authors                # look up and save
 *
 * Idempotent: only rows with a NULL author_id are processed, so a rerun picks
 * up anything that failed. Run `npm run init-db` first (adds the column).
 * Uses @discordjs/rest, which waits out rate limits itself; requests go one
 * at a time to leave headroom for the live bot, which shares the token.
 */
import 'dotenv/config';
import { DiscordAPIError, REST } from '@discordjs/rest';
import { Routes, type APIMessage } from 'discord-api-types/v10';
import { closePool, query } from '#config';
import { backfillAuthors, type AuthorLookup } from '../features/nominations/backfill.js';
import type { MessageRef } from '../shared/message-link.js';

// Discord error codes meaning the message can never be read again.
const GONE = new Set([
  10003, // Unknown Channel
  10004, // Unknown Guild
  10008, // Unknown Message
  50001, // Missing Access
  50013, // Missing Permissions
]);

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('DISCORD_TOKEN is not set');
  const rest = new REST({ version: '10' }).setToken(token);

  const lookupAuthor = async (ref: MessageRef): Promise<AuthorLookup> => {
    try {
      const message = (await rest.get(Routes.channelMessage(ref.channelId, ref.messageId))) as APIMessage;
      return { status: 'found', authorId: message.author.id };
    } catch (error) {
      if (error instanceof DiscordAPIError && typeof error.code === 'number' && GONE.has(error.code)) {
        return { status: 'missing' };
      }
      throw error;
    }
  };

  const saveAuthor = async (nominationId: number, authorId: string) => {
    await query('UPDATE nominations SET author_id = $2 WHERE id = $1 AND author_id IS NULL', [nominationId, authorId]);
  };

  const { rows } = await query<{ id: number; message_link: string }>(
    'SELECT id, message_link FROM nominations WHERE author_id IS NULL ORDER BY id'
  );
  console.log(`${rows.length} nominations without an author${dryRun ? ' (dry run: nothing will be saved)' : ''}.`);

  const summary = await backfillAuthors(rows, {
    lookupAuthor,
    saveAuthor,
    dryRun,
    onProgress: (done, total) => {
      if (done % 25 === 0 || done === total) console.log(`  ${done}/${total}`);
    },
  });

  console.log(
    `Found ${summary.found}${dryRun ? ' (not saved)' : ''}, gone ${summary.missing}, ` +
      `bad link ${summary.invalidLink}, failed ${summary.failed}.`
  );
  if (summary.failed > 0) console.log('Rerun to retry the failed ones.');
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
