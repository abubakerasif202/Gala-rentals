import { afterEach, describe, expect, it } from 'vitest';

import { resolveBackgroundJobQueueName } from './backgroundWorker.js';

const originalBackgroundJobQueue = process.env.BACKGROUND_JOB_QUEUE;
const originalDocumentPdfQueueName = process.env.DOCUMENT_PDF_QUEUE_NAME;

const restoreQueueEnv = () => {
  if (originalBackgroundJobQueue === undefined) {
    delete process.env.BACKGROUND_JOB_QUEUE;
  } else {
    process.env.BACKGROUND_JOB_QUEUE = originalBackgroundJobQueue;
  }

  if (originalDocumentPdfQueueName === undefined) {
    delete process.env.DOCUMENT_PDF_QUEUE_NAME;
  } else {
    process.env.DOCUMENT_PDF_QUEUE_NAME = originalDocumentPdfQueueName;
  }
};

afterEach(() => {
  restoreQueueEnv();
});

describe('resolveBackgroundJobQueueName', () => {
  it('uses the default queue when no queue is configured', () => {
    delete process.env.BACKGROUND_JOB_QUEUE;
    delete process.env.DOCUMENT_PDF_QUEUE_NAME;

    expect(resolveBackgroundJobQueueName()).toBe('default');
  });

  it('uses the shared background queue name', () => {
    process.env.BACKGROUND_JOB_QUEUE = 'documents';
    delete process.env.DOCUMENT_PDF_QUEUE_NAME;

    expect(resolveBackgroundJobQueueName()).toBe('documents');
  });

  it('allows the document PDF queue name to select the worker queue', () => {
    process.env.BACKGROUND_JOB_QUEUE = 'default';
    process.env.DOCUMENT_PDF_QUEUE_NAME = 'pdf-documents';

    expect(resolveBackgroundJobQueueName()).toBe('pdf-documents');
  });

  it('ignores blank queue overrides', () => {
    process.env.BACKGROUND_JOB_QUEUE = 'documents';
    process.env.DOCUMENT_PDF_QUEUE_NAME = '   ';

    expect(resolveBackgroundJobQueueName()).toBe('documents');
  });
});
