import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockClient, mockWithPostgresTransaction } = vi.hoisted(() => {
  const mockClient = { query: vi.fn() };
  return {
    mockClient,
    mockWithPostgresTransaction: vi.fn(
      async (callback: (client: typeof mockClient) => Promise<unknown>) =>
        callback(mockClient)
    ),
  };
});

vi.mock('../db/postgres.js', () => ({
  withPostgresTransaction: mockWithPostgresTransaction,
}));

import { claimNextJob, completeJob, enqueue, failJob } from './jobQueue.js';

const jobId = '6f9f2193-8a9d-49ef-b91d-114b1c5db99c';
const buildJob = (overrides: Record<string, unknown> = {}) => ({
  attempts: 1,
  completed_at: null,
  created_at: new Date('2026-06-28T00:00:00.000Z'),
  error_message: null,
  id: jobId,
  job_type: 'document.generate',
  locked_at: new Date('2026-06-28T00:00:01.000Z'),
  locked_until: new Date('2026-06-28T00:05:01.000Z'),
  max_attempts: 3,
  payload: { documentId: 'doc-safe-id' },
  queue_name: 'default',
  run_at: new Date('2026-06-28T00:00:00.000Z'),
  status: 'processing',
  updated_at: new Date('2026-06-28T00:00:01.000Z'),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('job queue', () => {
  it('enqueues validated JSON payloads using the caller transaction client', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [buildJob({ status: 'pending' })] });

    const result = await enqueue(
      mockClient as never,
      'document.generate',
      { documentId: 'doc-safe-id' },
      { maxAttempts: 5 }
    );

    expect(result.id).toBe(jobId);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public.background_jobs'),
      expect.arrayContaining([
        'default',
        'document.generate',
        JSON.stringify({ documentId: 'doc-safe-id' }),
        5,
      ])
    );
    expect(mockWithPostgresTransaction).not.toHaveBeenCalled();
  });

  it('rejects non-JSON payload values before querying', async () => {
    await expect(
      enqueue(mockClient as never, 'document.generate', {
        invalid: undefined,
      } as never)
    ).rejects.toThrow();
    expect(mockClient.query).not.toHaveBeenCalled();
  });

  it('claims pending or expired work with a lease and SKIP LOCKED', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [buildJob()] });

    const result = await claimNextJob('default');

    expect(result?.id).toBe(jobId);
    expect(mockWithPostgresTransaction).toHaveBeenCalledTimes(1);
    expect(mockClient.query.mock.calls[0]?.[0]).toContain(
      "status = 'processing'"
    );
    expect(mockClient.query.mock.calls[1]?.[0]).toContain(
      'FOR UPDATE SKIP LOCKED'
    );
    expect(mockClient.query.mock.calls[1]?.[0]).toContain('locked_until');
  });

  it('requeues failures with exponential backoff while attempts remain', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ attempts: 2, max_attempts: 3 }] })
      .mockResolvedValueOnce({
        rows: [buildJob({ attempts: 2, error_message: 'failed', status: 'pending' })],
      });

    const result = await failJob(jobId, new Error('failed'));

    expect(result.status).toBe('pending');
    expect(mockClient.query.mock.calls[1]?.[1]).toEqual([
      jobId,
      'pending',
      'failed',
      10000,
    ]);
  });

  it('completes only a currently processing job', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        buildJob({
          completed_at: new Date('2026-06-28T00:01:00.000Z'),
          locked_at: null,
          locked_until: null,
          status: 'completed',
        }),
      ],
    });

    const result = await completeJob(jobId);

    expect(result.status).toBe('completed');
    expect(mockClient.query.mock.calls[0]?.[0]).toContain(
      "WHERE id = $1 AND status = 'processing'"
    );
  });

  it('marks a job failed after its final attempt', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ attempts: 3, max_attempts: 3 }] })
      .mockResolvedValueOnce({
        rows: [buildJob({ attempts: 3, error_message: 'failed', status: 'failed' })],
      });

    const result = await failJob(jobId, new Error('failed'));

    expect(result.status).toBe('failed');
    expect(mockClient.query.mock.calls[1]?.[1]?.[1]).toBe('failed');
  });
});
