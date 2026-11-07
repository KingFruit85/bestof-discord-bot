import pg from 'pg';

// The bot's TIMESTAMP (without time zone) columns hold UTC, Neon's session
// time zone. pg's default parser reads them as local time, which would shift
// every date on a machine not running in UTC. OID 1114 is TIMESTAMP.
pg.types.setTypeParser(1114, (value: string) => new Date(`${value.replace(' ', 'T')}Z`));

export class MissingDatabaseUrlError extends Error {
  constructor() {
    super('DASHBOARD_DATABASE_URL is not set. Add it to dashboard/.env.local.');
    this.name = 'MissingDatabaseUrlError';
  }
}

// Cached on globalThis so dev-mode hot reloads reuse one pool.
const globalForPool = globalThis as typeof globalThis & { dashboardPool?: pg.Pool };

function getPool(): pg.Pool {
  const connectionString = process.env.DASHBOARD_DATABASE_URL;
  if (!connectionString) throw new MissingDatabaseUrlError();

  if (!globalForPool.dashboardPool) {
    const pool = new pg.Pool({ connectionString, max: 3 });
    // Second safeguard on top of the read-only role. pg queues queries per
    // client, so this runs before any query issued on the new connection.
    pool.on('connect', (client) => {
      client.query('SET default_transaction_read_only = on').catch((error) => {
        console.error('Failed to put dashboard connection in read-only mode:', error);
      });
    });
    globalForPool.dashboardPool = pool;
  }
  return globalForPool.dashboardPool;
}

export async function query<T extends pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}
