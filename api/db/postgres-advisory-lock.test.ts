import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalDatabaseUrl = process.env.DATABASE_URL;

const { mockClient, mockPool, mockPoolCtor } = vi.hoisted(() => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  const mockPool = {
    connect: vi.fn(),
    end: vi.fn(),
  };

  class MockPool {
    constructor() {
      return mockPool as unknown as MockPool;
    }
  }

  return { mockClient, mockPool, mockPoolCtor: MockPool };
});

vi.mock('pg', () => ({
  default: {
    Pool: mockPoolCtor,
  },
}));

beforeEach(() => {
  process.env.DATABASE_URL =
    'postgresql://postgres.example:secret@db.internal.example.com:5432/app';
  mockClient.query.mockReset();
  mockClient.release.mockReset();
  mockPool.connect.mockReset();
  mockPool.end.mockReset();
  mockPool.connect.mockResolvedValue(mockClient);
});

afterEach(() => {
  if (typeof originalDatabaseUrl === 'string') {
    process.env.DATABASE_URL = originalDatabaseUrl;
  } else {
    delete process.env.DATABASE_URL;
  }
});

describe('withPostgresAdvisoryLock', () => {
  it('acquires a transaction-level advisory lock inside a transaction', async () => {
    mockClient.query.mockResolvedValue(undefined);

    const { closePostgresPool, withPostgresAdvisoryLock } = await import('./postgres.js');
    const result = await withPostgresAdvisoryLock('vehicle-checkout:test', async () => 'ok');

    expect(result).toBe('ok');
    expect(mockPool.connect).toHaveBeenCalledTimes(1);
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      "SELECT set_config('lock_timeout', $1, true)",
      ['5000ms']
    );
    expect(String(mockClient.query.mock.calls[2][0])).toContain('pg_advisory_xact_lock');
    expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalledWith();

    await closePostgresPool();
  });

  it('rolls back and releases the client when lock acquisition fails', async () => {
    const lockError = new Error('lock timed out');
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) {
        throw lockError;
      }

      return undefined;
    });

    const { closePostgresPool, withPostgresAdvisoryLock } = await import('./postgres.js');

    await expect(
      withPostgresAdvisoryLock('vehicle-checkout:test', async () => 'ok')
    ).rejects.toThrow('lock timed out');

    expect(mockPool.connect).toHaveBeenCalledTimes(1);
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledWith();

    await closePostgresPool();
  });

  it('requires explicit pool closure before database configuration changes', async () => {
    mockClient.query.mockResolvedValue(undefined);
    const { closePostgresPool, withPostgresAdvisoryLock } = await import('./postgres.js');

    await withPostgresAdvisoryLock('vehicle-checkout:test', async () => 'ok');
    process.env.DATABASE_URL =
      'postgresql://postgres.example:secret@other.internal.example.com:5432/app';

    await expect(
      withPostgresAdvisoryLock('vehicle-checkout:test', async () => 'ok')
    ).rejects.toThrow('configuration changed after pool initialization');

    await closePostgresPool();
  });
});

describe('withPostgresTransaction', () => {
  it('rolls back and releases the client when transactional work fails', async () => {
    mockClient.query.mockResolvedValue(undefined);
    const workError = new Error('payment write failed');

    const { closePostgresPool, withPostgresTransaction } = await import('./postgres.js');

    await expect(
      withPostgresTransaction(async () => {
        throw workError;
      })
    ).rejects.toThrow('payment write failed');

    expect(mockPool.connect).toHaveBeenCalledTimes(1);
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalledWith();

    await closePostgresPool();
  });
});

describe('Postgres advisory lock key derivation', () => {
  it('is stable for the same input and differs for different inputs', async () => {
    const { toAdvisoryLockKeyParts } = await import('./postgres.js');

    expect(toAdvisoryLockKeyParts('vehicle-checkout:test')).toEqual(
      toAdvisoryLockKeyParts('vehicle-checkout:test')
    );
    expect(toAdvisoryLockKeyParts('vehicle-checkout:test')).not.toEqual(
      toAdvisoryLockKeyParts('vehicle-checkout:other')
    );
  });

  it('hashes lock keys inside the Gala Rentals namespace', async () => {
    const { POSTGRES_ADVISORY_LOCK_NAMESPACE, toAdvisoryLockKeyParts } =
      await import('./postgres.js');
    const digest = crypto
      .createHash('sha256')
      .update('galarentals:lock:vehicle-checkout:test')
      .digest();

    expect(POSTGRES_ADVISORY_LOCK_NAMESPACE).toBe('galarentals:lock:');
    expect(toAdvisoryLockKeyParts('vehicle-checkout:test')).toEqual([
      digest.readInt32BE(0),
      digest.readInt32BE(4),
    ]);
  });
});
