import type { PoolClient } from 'pg';
import { z } from 'zod';

import { withPostgresTransaction } from '../db/postgres.js';

const DEFAULT_QUEUE_NAME = 'default';
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const BASE_RETRY_DELAY_MS = 5 * 1000;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;
const MAX_ERROR_MESSAGE_LENGTH = 4000;

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

export const jobPayloadSchema = z.record(z.string(), jsonValueSchema);

const jobTypeSchema = z.string().trim().min(1).max(120);
const queueNameSchema = z.string().trim().min(1).max(120);
const jobIdSchema = z.string().uuid();
const enqueueOptionsSchema = z
  .object({
    maxAttempts: z.number().int().min(1).max(100).optional(),
    queueName: queueNameSchema.optional(),
    runAt: z.date().optional(),
  })
  .strict();

const databaseJobSchema = z.object({
  attempts: z.number().int().nonnegative(),
  completed_at: z.date().nullable(),
  created_at: z.date(),
  error_message: z.string().nullable(),
  id: jobIdSchema,
  job_type: jobTypeSchema,
  locked_at: z.date().nullable(),
  locked_until: z.date().nullable(),
  max_attempts: z.number().int().positive(),
  payload: jobPayloadSchema,
  queue_name: queueNameSchema,
  run_at: z.date(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  updated_at: z.date(),
});

export type JobPayload = z.infer<typeof jobPayloadSchema>;
export type BackgroundJob = z.infer<typeof databaseJobSchema>;
export type EnqueueJobOptions = z.infer<typeof enqueueOptionsSchema>;

const parseDatabaseJob = (row: unknown): BackgroundJob => {
  if (!row || typeof row !== 'object') {
    throw new Error('Background job query returned an invalid row.');
  }

  const normalized = { ...(row as Record<string, unknown>) };
  for (const column of [
    'completed_at',
    'created_at',
    'locked_at',
    'locked_until',
    'run_at',
    'updated_at',
  ]) {
    const value = normalized[column];
    if (typeof value === 'string' || typeof value === 'number') {
      normalized[column] = new Date(value);
    }
  }

  return databaseJobSchema.parse(normalized);
};

const getLeaseMs = () => {
  const configured = Number(process.env.BACKGROUND_JOB_LEASE_MS || DEFAULT_LEASE_MS);
  return Number.isInteger(configured) && configured >= 1000
    ? configured
    : DEFAULT_LEASE_MS;
};

const errorMessageFrom = (error: unknown) => {
  const rawMessage = error instanceof Error ? error.message : String(error);
  return (rawMessage.trim() || 'Background job failed').slice(
    0,
    MAX_ERROR_MESSAGE_LENGTH
  );
};

export const enqueue = async (
  client: PoolClient,
  jobType: string,
  payload: JobPayload,
  options: EnqueueJobOptions = {}
) => {
  const parsedJobType = jobTypeSchema.parse(jobType);
  const parsedPayload = jobPayloadSchema.parse(payload);
  const parsedOptions = enqueueOptionsSchema.parse(options);
  const result = await client.query(
    `
      INSERT INTO public.background_jobs (
        queue_name,
        job_type,
        payload,
        max_attempts,
        run_at
      )
      VALUES ($1, $2, $3::jsonb, $4, $5)
      RETURNING *
    `,
    [
      parsedOptions.queueName || DEFAULT_QUEUE_NAME,
      parsedJobType,
      JSON.stringify(parsedPayload),
      parsedOptions.maxAttempts || DEFAULT_MAX_ATTEMPTS,
      parsedOptions.runAt || new Date(),
    ]
  );

  return parseDatabaseJob(result.rows[0]);
};

export const claimNextJob = async (
  queueName = DEFAULT_QUEUE_NAME
): Promise<BackgroundJob | null> => {
  const parsedQueueName = queueNameSchema.parse(queueName);

  return withPostgresTransaction(async (client) => {
    await client.query(
      `
        UPDATE public.background_jobs
        SET
          status = 'failed',
          error_message = COALESCE(
            error_message,
            'Worker lease expired after the final allowed attempt.'
          ),
          locked_at = NULL,
          locked_until = NULL,
          updated_at = NOW()
        WHERE queue_name = $1
          AND status = 'processing'
          AND locked_until <= NOW()
          AND attempts >= max_attempts
      `,
      [parsedQueueName]
    );

    const result = await client.query(
      `
        WITH candidate AS (
          SELECT id
          FROM public.background_jobs
          WHERE queue_name = $1
            AND attempts < max_attempts
            AND (
              (status = 'pending' AND run_at <= NOW())
              OR (status = 'processing' AND locked_until <= NOW())
            )
          ORDER BY run_at ASC, created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE public.background_jobs AS job
        SET
          status = 'processing',
          attempts = job.attempts + 1,
          error_message = NULL,
          locked_at = NOW(),
          locked_until = NOW() + ($2 * INTERVAL '1 millisecond'),
          updated_at = NOW()
        FROM candidate
        WHERE job.id = candidate.id
        RETURNING job.*
      `,
      [parsedQueueName, getLeaseMs()]
    );

    return result.rows[0] ? parseDatabaseJob(result.rows[0]) : null;
  });
};

export const completeJob = async (jobId: string) => {
  const parsedJobId = jobIdSchema.parse(jobId);

  return withPostgresTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE public.background_jobs
        SET
          status = 'completed',
          error_message = NULL,
          locked_at = NULL,
          locked_until = NULL,
          completed_at = NOW(),
          updated_at = NOW()
        WHERE id = $1 AND status = 'processing'
        RETURNING *
      `,
      [parsedJobId]
    );

    if (!result.rows[0]) {
      throw new Error(`Background job ${parsedJobId} is not processing.`);
    }

    return parseDatabaseJob(result.rows[0]);
  });
};

export const failJob = async (jobId: string, error: unknown) => {
  const parsedJobId = jobIdSchema.parse(jobId);
  const errorMessage = errorMessageFrom(error);

  return withPostgresTransaction(async (client) => {
    const lockedResult = await client.query(
      `
        SELECT attempts, max_attempts
        FROM public.background_jobs
        WHERE id = $1 AND status = 'processing'
        FOR UPDATE
      `,
      [parsedJobId]
    );
    if (!lockedResult.rows[0]) {
      throw new Error(`Background job ${parsedJobId} is not processing.`);
    }
    const lockedJob = z
      .object({
        attempts: z.number().int().positive(),
        max_attempts: z.number().int().positive(),
      })
      .parse(lockedResult.rows[0]);
    const shouldRetry = lockedJob.attempts < lockedJob.max_attempts;
    const retryDelayMs = Math.min(
      BASE_RETRY_DELAY_MS * 2 ** Math.max(0, lockedJob.attempts - 1),
      MAX_RETRY_DELAY_MS
    );
    const result = await client.query(
      `
        UPDATE public.background_jobs
        SET
          status = $2,
          error_message = $3,
          run_at = CASE
            WHEN $2 = 'pending' THEN NOW() + ($4 * INTERVAL '1 millisecond')
            ELSE run_at
          END,
          locked_at = NULL,
          locked_until = NULL,
          updated_at = NOW()
        WHERE id = $1 AND status = 'processing'
        RETURNING *
      `,
      [
        parsedJobId,
        shouldRetry ? 'pending' : 'failed',
        errorMessage,
        retryDelayMs,
      ]
    );

    if (!result.rows[0]) {
      throw new Error(`Background job ${parsedJobId} is not processing.`);
    }

    return parseDatabaseJob(result.rows[0]);
  });
};
