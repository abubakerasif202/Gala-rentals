import pg from 'pg';

type PoolClient = import('pg').PoolClient;

const { Pool } = pg;

let postgresPool: InstanceType<typeof Pool> | null = null;

export const getDirectDatabaseConnectionString = () =>
  (process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '').trim();

export const hasDirectDatabaseConnection = () => Boolean(getDirectDatabaseConnectionString());

const getPostgresPool = () => {
  const connectionString = getDirectDatabaseConnectionString();
  if (!connectionString) {
    throw new Error(
      'SUPABASE_DB_URL or DATABASE_URL is required for transactional payment activation.'
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
