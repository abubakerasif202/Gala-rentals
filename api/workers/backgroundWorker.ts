import '../../scripts/load-env.js';

import { pathToFileURL } from 'node:url';

import {
  checkDirectDatabaseHealth,
  closePostgresPool,
  getSessionModePostgresRequirementIssue,
} from '../db/postgres.js';
import {
  claimNextJob,
  completeJob,
  failJob,
  type BackgroundJob,
  type JobPayload,
} from '../services/jobQueue.js';

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_QUEUE_NAME = 'default';

export type BackgroundJobHandler = (
  payload: JobPayload,
  job: BackgroundJob
) => Promise<void>;
export type BackgroundJobHandlers = Readonly<Record<string, BackgroundJobHandler>>;

// Add narrowly scoped PDF/email handlers here as those routes are migrated.
// Handlers run after claimNextJob's transaction has committed.
export const backgroundJobHandlers: BackgroundJobHandlers = {};

const getPollIntervalMs = () => {
  const configured = Number(
    process.env.BACKGROUND_JOB_POLL_INTERVAL_MS || DEFAULT_POLL_INTERVAL_MS
  );
  return Number.isInteger(configured) && configured >= 250
    ? configured
    : DEFAULT_POLL_INTERVAL_MS;
};

const getQueueName = () =>
  (process.env.BACKGROUND_JOB_QUEUE || DEFAULT_QUEUE_NAME).trim() ||
  DEFAULT_QUEUE_NAME;

const logJob = (
  level: 'info' | 'warn' | 'error',
  message: string,
  job: Pick<BackgroundJob, 'id' | 'job_type'>
) => {
  console[level](
    JSON.stringify({
      jobId: job.id,
      jobType: job.job_type,
      message,
    })
  );
};

export const processNextBackgroundJob = async (
  handlers: BackgroundJobHandlers = backgroundJobHandlers,
  queueName = getQueueName()
) => {
  const job = await claimNextJob(queueName);
  if (!job) {
    return false;
  }

  logJob('info', 'Background job claimed.', job);
  const handler = handlers[job.job_type];

  try {
    if (!handler) {
      throw new Error('No background job handler is registered for this job type.');
    }

    await handler(job.payload, job);
    await completeJob(job.id);
    logJob('info', 'Background job completed.', job);
  } catch (error) {
    await failJob(job.id, error);
    logJob('error', 'Background job failed; retry policy applied.', job);
  }

  return true;
};

const waitForNextPoll = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const timeout = setTimeout(resolve, milliseconds);
    timeout.unref?.();
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
  });

export const runBackgroundWorker = async (
  handlers: BackgroundJobHandlers = backgroundJobHandlers
) => {
  const sessionModeIssue = getSessionModePostgresRequirementIssue();
  if (sessionModeIssue) {
    throw new Error(sessionModeIssue);
  }

  const directHealth = await checkDirectDatabaseHealth();
  if (
    !directHealth.configured ||
    directHealth.mode !== 'session' ||
    directHealth.schemaIssues.length > 0
  ) {
    throw new Error(
      `Background worker database readiness failed: ${
        directHealth.schemaIssues.join(', ') || 'session database unavailable'
      }.`
    );
  }

  const shutdownController = new AbortController();
  const requestShutdown = (signal: string) => {
    console.info(`Received ${signal}. Background worker will stop after current work.`);
    shutdownController.abort();
  };
  process.once('SIGTERM', () => requestShutdown('SIGTERM'));
  process.once('SIGINT', () => requestShutdown('SIGINT'));

  console.info(
    `Background worker started for queue ${getQueueName()} with ${getPollIntervalMs()}ms polling.`
  );

  try {
    while (!shutdownController.signal.aborted) {
      let processed = false;
      try {
        processed = await processNextBackgroundJob(handlers);
      } catch {
        console.error('Background worker polling failed; retrying after the polling interval.');
      }
      if (!processed) {
        await waitForNextPoll(
          getPollIntervalMs(),
          shutdownController.signal
        );
      }
    }
  } finally {
    await closePostgresPool();
    console.info('Background worker stopped.');
  }
};

const isEntrypoint =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1] as string).href;

if (isEntrypoint) {
  void runBackgroundWorker().catch(async (error) => {
    console.error('Background worker terminated after an unrecoverable error.');
    await closePostgresPool().catch(() => undefined);
    process.exitCode = 1;
  });
}
