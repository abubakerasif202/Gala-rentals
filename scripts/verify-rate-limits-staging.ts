import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import type { Options } from 'express-rate-limit';

const connectionString = process.env.GALA_LOCAL_STAGING_DB_URL;
if (!connectionString) throw new Error('GALA_LOCAL_STAGING_DB_URL is required; production connection variables are never used.');
const target = new URL(connectionString);
if (target.hostname !== '127.0.0.1' || target.port !== '55472' || target.pathname !== '/galarentals_staging') {
  throw new Error('Refusing rate-limit DDL outside the dedicated local GalaRentals staging database.');
}
const pool = new pg.Pool({ connectionString, max: 2 });
const results: string[] = [];
try {
  const identity = await pool.query('SELECT current_database() AS database_name');
  assert.equal(identity.rows[0].database_name, 'galarentals_staging');
  await pool.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
  END $$;`);
  await pool.query('ALTER ROLE service_role BYPASSRLS');
  const migration = await readFile(new URL('../supabase/migrations/20261009090000_add_serverless_rate_limits.sql', import.meta.url), 'utf8');
  await pool.query(migration);
  await pool.query(migration);
  results.push('PASS: additive migration applies and replays idempotently on local PostgreSQL 17');
  const security = await pool.query(`SELECT c.relrowsecurity AS rls,
    has_table_privilege('anon','public.api_rate_limits','INSERT') AS anon_insert,
    has_table_privilege('authenticated','public.api_rate_limits','SELECT') AS authenticated_select,
    has_table_privilege('service_role','public.api_rate_limits','INSERT') AS service_insert
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='api_rate_limits'`);
  assert.equal(security.rows[0].rls, true);
  assert.equal(security.rows[0].anon_insert, false);
  assert.equal(security.rows[0].authenticated_select, false);
  assert.equal(security.rows[0].service_insert, true);
  const roleClient = await pool.connect();
  try {
    await roleClient.query('BEGIN');
    await roleClient.query('SET LOCAL ROLE anon');
    await assert.rejects(roleClient.query('SELECT * FROM public.api_rate_limits LIMIT 0'), (error: {code?: string}) => error.code === '42501');
    await roleClient.query('ROLLBACK');
    await roleClient.query('BEGIN');
    await roleClient.query('SET LOCAL ROLE service_role');
    await roleClient.query("INSERT INTO public.api_rate_limits (key,hits,reset_at) VALUES ('local-role-fixture',1,now())");
    await roleClient.query('ROLLBACK');
  } finally { roleClient.release(); }
  results.push('PASS: RLS enabled; anon/authenticated denied; service role permitted');
  process.env.DATABASE_URL = connectionString;
  delete process.env.SUPABASE_DB_URL;
  process.env.VERCEL = '1';
  const { PostgresRateLimitStore } = await import('../api/middleware/distributedRateLimit.js');
  const { closePostgresPool, withPostgresTransactionAdvisoryLock } = await import('../api/db/postgres.js');
  const first = new PostgresRateLimitStore('gala-local-concurrency');
  const second = new PostgresRateLimitStore('gala-local-concurrency');
  first.init({ windowMs: 60000 } as Options); second.init({ windowMs: 60000 } as Options);
  const key = `fixture-${Date.now()}`;
  const counts = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? first : second).increment(key)));
  assert.deepEqual(counts.map(value => value.totalHits).sort((a,b) => a-b), Array.from({ length: 20 }, (_, i) => i+1));
  await first.decrement(key);
  assert.equal((await second.increment(key)).totalHits, 20);
  await first.resetKey(key);
  assert.equal((await second.increment(key)).totalHits, 1);
  await first.resetKey(key);
  results.push('PASS: 20 concurrent requests across two store instances share exact atomic counts; decrement/reset work');
  const order: number[] = [];
  let activeLocks = 0;
  let maximumActiveLocks = 0;
  await Promise.all(Array.from({length: 5}, (_, i) => withPostgresTransactionAdvisoryLock('gala-staging-lock-fixture', async () => {
    activeLocks++; maximumActiveLocks = Math.max(maximumActiveLocks, activeLocks);
    await pool.query('SELECT pg_sleep(0.02)');
    order.push(i); activeLocks--;
  })));
  assert.equal(order.length, 5);
  assert.equal(maximumActiveLocks, 1);
  results.push('PASS: transaction-scoped advisory locks operate on the staging database');
  await closePostgresPool();
  console.log(results.join('\n'));
} finally { await pool.end(); }
