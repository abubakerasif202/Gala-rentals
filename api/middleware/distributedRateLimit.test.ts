import { beforeEach, describe, expect, it, vi } from 'vitest';
const query = vi.hoisted(() => vi.fn());
vi.mock('../db/postgres.js', () => ({ withPostgresTransaction: (operation: (client: unknown) => Promise<unknown>) => operation({ query }) }));
import { PostgresRateLimitStore } from './distributedRateLimit.js';

beforeEach(() => vi.clearAllMocks());
describe('shared function rate limits', () => {
  it('shares counters across instances without storing raw IP or email values', async () => {
    query.mockResolvedValue({ rows: [{ hits: 2, reset_at: '2026-10-10T00:00:00Z' }] });
    const first = new PostgresRateLimitStore('login');
    const second = new PostgresRateLimitStore('login');
    expect((await first.increment('private-ip-admin-email')).totalHits).toBe(2);
    await second.increment('private-ip-admin-email');
    expect(query.mock.calls[0][1][0]).toBe(query.mock.calls[1][1][0]);
    expect(query.mock.calls[0][1][0]).toMatch(/^[a-f0-9]{64}$/);
    await new PostgresRateLimitStore('applications').increment('private-ip-admin-email');
    expect(query.mock.calls[2][1][0]).not.toBe(query.mock.calls[0][1][0]);
  });
  it('propagates database failure instead of allowing unlimited login attempts', async () => {
    query.mockRejectedValue(new Error('database unavailable'));
    await expect(new PostgresRateLimitStore('login').increment('client')).rejects.toThrow('unavailable');
  });
});
