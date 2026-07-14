import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('importing config/init-db.js does not attempt a database connection or exit the process', () => {
  // Runs in a subprocess so a stray process.exit(1) doesn't kill this test file.
  // No DATABASE_URL is set, so if initializeDatabase() fires unconditionally,
  // it kicks off an unawaited async DB connection attempt that keeps the event
  // loop alive; once it fails, it calls process.exit(1), which this subprocess
  // will surface as a non-zero exit code caught by execFileSync.
  // (We deliberately do NOT call process.exit(0) ourselves after the import
  // resolves - the whole point is to let the process run to natural completion
  // so any dangling side effect from the import gets a chance to fire.)
  const result = execFileSync(
    process.execPath,
    ['--import', 'tsx', '-e', "import('./src/config/init-db.js').then(() => { console.log('IMPORT_OK'); })"],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: '' },
      encoding: 'utf-8',
      timeout: 5000,
    }
  );

  assert.match(result, /IMPORT_OK/);
});
