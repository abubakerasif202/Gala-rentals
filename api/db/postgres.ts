import crypto from 'node:crypto';
import pg from 'pg';

type PoolClient = import('pg').PoolClient;
type PostgresConnectionMode = 'none' | 'session' | 'transaction';

const { Pool } = pg;

let postgresPool: InstanceType<typeof Pool> | null = null;

export const getDirectDatabaseConnectionString = () =>
  (process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '').trim();

const inferPostgresConnectionMode = (
  connectionString: string
): PostgresConnectionMode => {
  if (!connectionString) {
    return 'none';
  }

  try {
    const url = new URL(connectionString);
    return url.port === '6543' ? 'transaction' : 'session';
  } catch {
    return connectionString.includes(':6543') ? 'transaction' : 'session';
  }
};

export const getPostgresConnectionMode = () =>
  inferPostgresConnectionMode(getDirectDatabaseConnectionString());

export const hasDirectDatabaseConnection = () =>
  getPostgresConnectionMode() === 'session';

const getPostgresPool = () => {
  const connectionString = getDirectDatabaseConnectionString();
  const connectionMode = inferPostgresConnectionMode(connectionString);

  if (connectionMode === 'none') {
    throw new Error(
      'SUPABASE_DB_URL or DATABASE_URL is required for transactional payment activation.'
    );
  }

  if (connectionMode !== 'session') {
    throw new Error(
      'Transactional payment activation requires a session-capable Postgres connection. ' +
        'Supabase transaction pooler URLs on port 6543 are not supported for this path.'
    );
  }

  if (!postgresPool) {
    postgresPool = new Pool({
      connectionString,
      max: 5,
    });
  }

  return postgresPool;
};

export const withPostgresTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
) => {
  const client = await getPostgresPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Failed to rollback PostgreSQL transaction:', rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
};

const toAdvisoryLockKeyParts = (lockKey: string): [number, number] => {
  const digest = crypto.createHash('sha256').update(lockKey).digest();
  return [digest.readInt32BE(0), digest.readInt32BE(4)];
};

export const withPostgresAdvisoryLock = async <T>(
  lockKey: string,
  callback: () => Promise<T>
) => {
  const client = await getPostgresPool().connect();
  const [keyPartOne, keyPartTwo] = toAdvisoryLockKeyParts(lockKey);

  try {
    await client.query('SELECT pg_advisory_lock($1, $2)', [
      keyPartOne,
      keyPartTwo,
    ]);

    return await callback();
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1, $2)', [
        keyPartOne,
        keyPartTwo,
      ]);
    } catch (unlockError) {
      console.error('Failed to release PostgreSQL advisory lock:', unlockError);
    }

    client.release();
  }
};

export const closePostgresPool = async () => {
  if (!postgresPool) {
    return;
  }

  const pool = postgresPool;
  postgresPool = null;
  await pool.end();
};
