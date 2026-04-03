import crypto from 'node:crypto';
import pg from 'pg';

type PoolClient = import('pg').PoolClient;
type PostgresConnectionMode = 'none' | 'session' | 'transaction';

const { Pool } = pg;

let postgresPool: InstanceType<typeof Pool> | null = null;

export const getDirectDatabaseConnectionString = () =>
  (process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '').trim();

export const shouldUseRelaxedPostgresSsl = (connectionString: string) => {
  if (!connectionString) {
    return false;
  }

  try {
    return new URL(connectionString).hostname.endsWith('.pooler.supabase.com');
  } catch {
    return connectionString.includes('.pooler.supabase.com');
  }
};

const getPostgresSslConfig = (connectionString: string) =>
  shouldUseRelaxedPostgresSsl(connectionString)
    ? { rejectUnauthorized: false as const }
    : undefined;

const inferPostgresConnectionMode = (
  connectionString: string
): PostgresConnectionMode => {
  if (!connectionString) {
    return 'none';
  }

  try {
    const url = new URL(connectionString);
    // Only treat Supabase pooler hosts as transaction-mode on 6543.
    // Non-Supabase hosts may legitimately expose session-capable connections on that port.
    const isSupabasePoolerHost = url.hostname.endsWith('.pooler.supabase.com');
    return isSupabasePoolerHost && url.port === '6543' ? 'transaction' : 'session';
  } catch {
    const normalized = connectionString.trim();
    const isSupabaseTransactionPoolerDsn =
      /^postgres(?:ql)?:\/\/(?:[^@\s/]+@)?[^:\s/]+\.pooler\.supabase\.com:6543(?:\/|$)/i.test(
        normalized
      );

    return isSupabaseTransactionPoolerDsn ? 'transaction' : 'session';
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
      'SUPABASE_DB_URL or DATABASE_URL is required for transactional data operations.'
    );
  }

  if (!postgresPool) {
    // When using Supabase Transaction Pooler (port 6543), we optimize for high concurrency.
    // Note: Session-based features like pg_advisory_lock() are not reliable in transaction mode.
    const ssl = getPostgresSslConfig(connectionString);
    postgresPool = new Pool({
      connectionString,
      max: connectionMode === 'transaction' ? 20 : 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ...(ssl ? { ssl } : {}),
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
  const pool = getPostgresPool();
  const connectionString = getDirectDatabaseConnectionString();
  const connectionMode = inferPostgresConnectionMode(connectionString);

  if (connectionMode === 'transaction') {
    throw new Error(
      'PostgreSQL advisory locks are not supported when using a transaction-mode pooler (port 6543). ' +
        'Please use a direct connection or session-mode pooler (port 5432) for this operation.'
    );
  }

  const client = await pool.connect();
  const [keyPartOne, keyPartTwo] = toAdvisoryLockKeyParts(lockKey);
  let releaseReason: unknown = true;

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
      releaseReason = unlockError ?? true;
      console.error('Failed to release PostgreSQL advisory lock:', unlockError);
    }

    client.release(releaseReason);
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
