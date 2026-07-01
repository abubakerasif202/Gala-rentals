import type { PoolClient } from 'pg';
import { z } from 'zod';

import { db } from '../db/index.js';
import { withPostgresTransaction } from '../db/postgres.js';
import { getManualInvoiceById } from '../manualInvoices.js';
import { fetchAgreementTemplateById } from '../agreementTemplates.js';
import { buildCarLeaseAgreementPdf } from '../templates/carLeaseAgreementPdf.js';
import { renderManualInvoicePdf } from '../templates/manualInvoicePdf.js';
import { buildTollTransferNoticePdf } from '../templates/tollTransferNoticePdf.js';
import { leaseAgreementSchema } from '../validation.js';
import {
  enqueue,
  getJob,
  type BackgroundJob,
  type JobPayload,
} from './jobQueue.js';

export const DOCUMENT_PDF_JOB_TYPE = 'document.pdf.generate';
export const DOCUMENT_PDF_QUEUE_NAME =
  (
    process.env.DOCUMENT_PDF_QUEUE_NAME ||
    process.env.BACKGROUND_JOB_QUEUE ||
    'default'
  ).trim() || 'default';
const DOCUMENTS_BUCKET =
  (process.env.SUPABASE_DOCUMENT_PDF_BUCKET || 'applications').trim() ||
  'applications';

const documentKindSchema = z.enum([
  'manual-invoice',
  'toll-transfer-notice',
  'fillable-lease-agreement',
]);

const basePayloadSchema = z.object({
  kind: documentKindSchema,
});

const manualInvoicePayloadSchema = basePayloadSchema.extend({
  kind: z.literal('manual-invoice'),
  invoiceId: z.string().trim().min(1),
});

const tollNoticePayloadSchema = basePayloadSchema.extend({
  kind: z.literal('toll-transfer-notice'),
  noticeId: z.number().int().positive(),
});

const agreementPayloadSchema = basePayloadSchema.extend({
  kind: z.literal('fillable-lease-agreement'),
  payload: leaseAgreementSchema,
  templateId: z.number().int().nonnegative(),
});

const documentPdfJobPayloadSchema = z.discriminatedUnion('kind', [
  manualInvoicePayloadSchema,
  tollNoticePayloadSchema,
  agreementPayloadSchema,
]);

const documentPdfJobResultSchema = z.object({
  contentType: z.literal('application/pdf'),
  filename: z.string().trim().min(1).max(180),
  storageBucket: z.string().trim().min(1).max(120),
  storagePath: z.string().trim().min(1).max(500),
});

export type DocumentPdfJobPayload = z.infer<typeof documentPdfJobPayloadSchema>;
export type DocumentPdfJobResult = z.infer<typeof documentPdfJobResultSchema>;

const safePdfFilename = (filename: string) =>
  filename.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 180);

const getStoragePath = (jobId: string, filename: string) =>
  `generated-documents/${jobId}/${safePdfFilename(filename)}`;

const enqueueDocumentJob = async (
  client: PoolClient,
  payload: DocumentPdfJobPayload
) =>
  enqueue(client, DOCUMENT_PDF_JOB_TYPE, payload as JobPayload, {
    maxAttempts: 3,
    queueName: DOCUMENT_PDF_QUEUE_NAME,
  });

export const createManualInvoicePdfJob = (invoiceId: string) =>
  withPostgresTransaction((client) =>
    enqueueDocumentJob(client, {
      invoiceId,
      kind: 'manual-invoice',
    })
  );

export const createTollNoticePdfJob = (noticeId: number) =>
  withPostgresTransaction((client) =>
    enqueueDocumentJob(client, {
      kind: 'toll-transfer-notice',
      noticeId,
    })
  );

export const createAgreementPdfJob = (
  templateId: number,
  payload: z.infer<typeof leaseAgreementSchema>
) =>
  withPostgresTransaction((client) =>
    enqueueDocumentJob(client, {
      kind: 'fillable-lease-agreement',
      payload,
      templateId,
    })
  );

export const getDocumentPdfJob = async (jobId: string) => {
  const job = await getJob(jobId);
  if (!job || job.job_type !== DOCUMENT_PDF_JOB_TYPE) {
    return null;
  }

  return job;
};

export const toDocumentPdfJobStatusResponse = (job: BackgroundJob) => {
  const result = job.result
    ? documentPdfJobResultSchema.safeParse(job.result)
    : null;
  const downloadUrl =
    job.status === 'completed' && result?.success
      ? `/api/admin/document-pdf-jobs/${job.id}/download`
      : null;

  return {
    attempts: job.attempts,
    completed_at: job.completed_at?.toISOString() ?? null,
    download_url: downloadUrl,
    error: job.status === 'failed' ? job.error_message : null,
    id: job.id,
    status: job.status,
  };
};

const fetchTollNoticeById = async (noticeId: number) => {
  const { data, error } = await db
    .from('toll_transfer_notices')
    .select('*')
    .eq('id', noticeId)
    .single();

  if (error || !data) {
    throw new Error('Toll transfer notice not found.');
  }

  return data as Record<string, unknown>;
};

const renderDocumentPdf = async (
  payload: DocumentPdfJobPayload
): Promise<{ buffer: Buffer; filename: string }> => {
  if (payload.kind === 'manual-invoice') {
    const invoice = await getManualInvoiceById(payload.invoiceId);
    if (!invoice) {
      throw new Error('Manual invoice not found.');
    }

    return {
      buffer: await renderManualInvoicePdf(invoice),
      filename: `galarentals-invoice-${invoice.invoice_number}.pdf`,
    };
  }

  if (payload.kind === 'toll-transfer-notice') {
    const notice = await fetchTollNoticeById(payload.noticeId);
    return {
      buffer: await buildTollTransferNoticePdf(notice as any),
      filename: `toll-transfer-notice-${payload.noticeId}.pdf`,
    };
  }

  const template = await fetchAgreementTemplateById(payload.templateId);
  if (!template) {
    throw new Error('Agreement template not found.');
  }

  return {
    buffer: Buffer.from(await buildCarLeaseAgreementPdf(payload.payload)),
    filename: 'gala-rentals-fillable-lease-agreement.pdf',
  };
};

export const processDocumentPdfJob = async (
  payload: JobPayload,
  job: BackgroundJob
) => {
  const parsedPayload = documentPdfJobPayloadSchema.parse(payload);
  const rendered = await renderDocumentPdf(parsedPayload);
  const filename = safePdfFilename(rendered.filename);
  const storagePath = getStoragePath(job.id, filename);
  const { error } = await db.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, rendered.buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    throw new Error(`Document PDF upload failed: ${error.message || 'storage error'}`);
  }

  return {
    contentType: 'application/pdf',
    filename,
    storageBucket: DOCUMENTS_BUCKET,
    storagePath,
  };
};

export const downloadDocumentPdfJobResult = async (jobId: string) => {
  const job = await getDocumentPdfJob(jobId);
  if (!job) {
    return null;
  }

  if (job.status !== 'completed') {
    return { job, pending: true as const };
  }

  const parsedResult = documentPdfJobResultSchema.safeParse(job.result);
  if (!parsedResult.success) {
    throw new Error('Document PDF job completed without a downloadable result.');
  }

  const { data, error } = await db.storage
    .from(parsedResult.data.storageBucket)
    .download(parsedResult.data.storagePath);

  if (error || !data) {
    throw new Error('Generated document PDF could not be downloaded.');
  }

  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    filename: parsedResult.data.filename,
    job,
    pending: false as const,
  };
};
