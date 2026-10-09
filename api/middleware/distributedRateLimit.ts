import crypto from 'node:crypto';
import type { Options, Store } from 'express-rate-limit';
import { withPostgresTransaction } from '../db/postgres.js';

// One atomic counter shared by every function instance. Fail closed on DB errors.
export class PostgresRateLimitStore implements Store {
  localKeys = false;
  private windowMs = 60000;
  constructor(public prefix: string) {}
  init(options: Options) { this.windowMs = options.windowMs; }
  private key(value: string) {
    return crypto.createHash('sha256').update(`${this.prefix}:${value}`).digest('hex');
  }
  async increment(key: string) {
    return withPostgresTransaction(async client => {
      const { rows } = await client.query(
        `INSERT INTO public.api_rate_limits (key, hits, reset_at)
         VALUES ($1, 1, clock_timestamp() + $2 * interval '1 millisecond')
         ON CONFLICT (key) DO UPDATE SET
           hits = CASE WHEN api_rate_limits.reset_at <= clock_timestamp() THEN 1 ELSE api_rate_limits.hits + 1 END,
           reset_at = CASE WHEN api_rate_limits.reset_at <= clock_timestamp() THEN clock_timestamp() + $2 * interval '1 millisecond' ELSE api_rate_limits.reset_at END
         RETURNING hits, reset_at`, [this.key(key), this.windowMs]);
      return { totalHits: Number(rows[0].hits), resetTime: new Date(rows[0].reset_at) };
    });
  }
  async decrement(key: string) {
    await withPostgresTransaction(client => client.query(
      'UPDATE public.api_rate_limits SET hits = GREATEST(hits - 1, 0) WHERE key = $1', [this.key(key)]));
  }
  async resetKey(key: string) {
    await withPostgresTransaction(client => client.query('DELETE FROM public.api_rate_limits WHERE key = $1', [this.key(key)]));
  }
}

export const serverlessRateLimitStore = (prefix: string) =>
  process.env.VERCEL === '1' ? new PostgresRateLimitStore(prefix) : undefined;
