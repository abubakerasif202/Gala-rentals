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
  it('releases the pool client without a destroy reason when unlocking succeeds', async () => {
    mockClient.query.mockResolvedValue(undefined);

    const { closePostgresPool, withPostgresAdvisoryLock } = await import('./postgres.js');
    const result = await withPostgresAdvisoryLock('vehicle-checkout:test', async () => 'ok');

    expect(result).toBe('ok');
    expect(mockPool.connect).toHaveBeenCalledTimes(1);
    expect(mockClient.query).toHaveBeenCalledTimes(2);
    expect(mockClient.release).toHaveBeenCalledWith();

    await closePostgresPool();
  });

  it('releases the pool client with a truthy reason when unlocking fails', async () => {
    const unlockError = new Error('unlock failed');
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes('pg_advisory_unlock')) {
        throw unlockError;
      }

      return undefined;
    });

    const { closePostgresPool, withPostgresAdvisoryLock } = await import('./postgres.js');
    const result = await withPostgresAdvisoryLock('vehicle-checkout:test', async () => 'ok');

    expect(result).toBe('ok');
    expect(mockPool.connect).toHaveBeenCalledTimes(1);
    expect(mockClient.query).toHaveBeenCalledTimes(2);
    expect(mockClient.release).toHaveBeenCalledWith(unlockError);

    await closePostgresPool();
  });
});
