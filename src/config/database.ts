import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { config } from 'dotenv';

config();

// Create a singleton pool instance
let pool: Pool | null = null;

/**
 * Get or create the database connection pool
 * Uses singleton pattern to ensure only one pool exists
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('connect', () => {
      console.log('New database client connected');
    });

    pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });

    console.log('Database pool created');
  }

  return pool;
}

/**
 * Execute a query using the pool
 * This is a convenience wrapper around pool.query
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();
  
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    
    console.log('Query executed:', {
      text: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount
    });
    
    return result;
  } catch (error) {
    console.error('Query error:', {
      text: text.substring(0, 100),
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * Remember to release it when done!
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return await pool.connect();
}

/**
 * Close the database pool (call on shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database pool closed');
  }
}

/**
 * Test the database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as now');
    console.log('Database connection test successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}