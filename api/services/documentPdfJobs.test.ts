import { beforeEach, describe, expect, it, vi } from 'vitest';

const jobId = '6f9f2193-8a9d-49ef-b91d-114b1c5db99c';

const {
  mockDownload,
  mockEnqueue,
  mockFetchAgreementTemplateById,
  mockGetJob,
  mockGetManualInvoiceById,
  mockStorageFrom,
  mockUpload,
  mockWithPostgresTransaction,
} = vi.hoisted(() => ({
  mockDownload: vi.fn(),
  mockEnqueue: vi.fn(),
  mockFetchAgreementTemplateById: vi.fn(),
  mockGetJob: vi.fn(),
  mockGetManualInvoiceById: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockUpload: vi.fn(),
  mockWithPostgresTransaction: vi.fn(async (callback: (client: unknown) => Promise<unknown>) =>
    callback({ query: vi.fn() })
  ),
}));

vi.mock('../db/postgres.js', () => ({
  withPostgresTransaction: mockWithPostgresTransaction,
}));

vi.mock('../db/index.js', () => ({
  db: {
    storage: {
      from: mockStorageFrom,
    },
  },
}));

vi.mock('../manualInvoices.js', () => ({
  getManualInvoiceById: mockGetManualInvoiceById,
}));

vi.mock('../agreementTemplates.js', () => ({
  fetchAgreementTemplateById: mockFetchAgreementTemplateById,
}));

vi.mock('../templates/manualInvoicePdf.js', () => ({
  renderManualInvoicePdf: vi.fn(async () => Buffer.from('%PDF-manual')),
}));

vi.mock('../templates/tollTransferNoticePdf.js', () => ({
  buildTollTransferNoticePdf: vi.fn(async () => Buffer.from('%PDF-toll')),
}));

vi.mock('../templates/carLeaseAgreementPdf.js', () => ({
  buildCarLeaseAgreementPdf: vi.fn(async () => new Uint8Array(Buffer.from('%PDF-agreement'))),
}));

vi.mock('./jobQueue.js', async () => {
  const actual = await vi.importActual<typeof import('./jobQueue.js')>('./jobQueue.js');
  return {
    ...actual,
    enqueue: mockEnqueue,
    getJob: mockGetJob,
  };
});

import {
  DOCUMENT_PDF_JOB_TYPE,
  createManualInvoicePdfJob,
  downloadDocumentPdfJobResult,
  processDocumentPdfJob,
  toDocumentPdfJobStatusResponse,
} from './documentPdfJobs.js';

const buildJob = (overrides: Record<string, unknown> = {}) => ({
  attempts: 1,
  completed_at: null,
  created_at: new Date('2026-07-01T00:00:00.000Z'),
  error_message: null,
  id: jobId,
  job_type: DOCUMENT_PDF_JOB_TYPE,
  locked_at: new Date('2026-07-01T00:00:01.000Z'),
  locked_until: new Date('2026-07-01T00:05:01.000Z'),
  max_attempts: 3,
  payload: { invoiceId: 'inv-1', kind: 'manual-invoice' },
  queue_name: 'documents',
  result: null,
  run_at: new Date('2026-07-01T00:00:00.000Z'),
  status: 'processing',
  updated_at: new Date('2026-07-01T00:00:01.000Z'),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageFrom.mockReturnValue({
    download: mockDownload,
    upload: mockUpload,
  });
});

describe('document PDF jobs', () => {
  it('creates stable background jobs for manual invoice PDF generation', async () => {
    mockEnqueue.mockResolvedValueOnce(buildJob({ status: 'pending' }));

    const job = await createManualInvoicePdfJob('inv-1');

    expect(job.id).toBe(jobId);
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.anything(),
      DOCUMENT_PDF_JOB_TYPE,
      { invoiceId: 'inv-1', kind: 'manual-invoice' },
      expect.objectContaining({ queueName: 'default' })
    );
  });

  it('returns status without leaking private storage paths or signed URLs', () => {
    const response = toDocumentPdfJobStatusResponse(
      buildJob({
        completed_at: new Date('2026-07-01T00:01:00.000Z'),
        result: {
          contentType: 'application/pdf',
          filename: 'galarentals-invoice-1.pdf',
          storageBucket: 'applications',
          storagePath: 'generated-documents/private/file.pdf',
        },
        status: 'completed',
      }) as never
    );

    expect(response).toMatchObject({
      download_url: `/api/admin/document-pdf-jobs/${jobId}/download`,
      id: jobId,
      status: 'completed',
    });
    expect(JSON.stringify(response)).not.toContain('generated-documents/private/file.pdf');
    expect(JSON.stringify(response)).not.toContain('signedUrl');
  });

  it('reports failure status without document result URLs', () => {
    const response = toDocumentPdfJobStatusResponse(
      buildJob({
        error_message: 'render failed',
        status: 'failed',
      }) as never
    );

    expect(response).toMatchObject({
      download_url: null,
      error: 'render failed',
      status: 'failed',
    });
  });

  it('uploads generated PDFs with retry-safe upsert behavior', async () => {
    mockGetManualInvoiceById.mockResolvedValueOnce({
      invoice_number: 'INV-001',
    });
    mockUpload.mockResolvedValueOnce({ error: null });

    const result = await processDocumentPdfJob(
      { invoiceId: 'inv-1', kind: 'manual-invoice' },
      buildJob() as never
    );

    expect(mockUpload).toHaveBeenCalledWith(
      'generated-documents/6f9f2193-8a9d-49ef-b91d-114b1c5db99c/galarentals-invoice-INV-001.pdf',
      expect.any(Buffer),
      expect.objectContaining({
        contentType: 'application/pdf',
        upsert: true,
      })
    );
    expect(result).toMatchObject({
      contentType: 'application/pdf',
      filename: 'galarentals-invoice-INV-001.pdf',
      storageBucket: 'applications',
    });
  });

  it('streams completed job downloads through backend storage without exposing signed URLs', async () => {
    mockGetJob.mockResolvedValueOnce(
      buildJob({
        result: {
          contentType: 'application/pdf',
          filename: 'galarentals-invoice-1.pdf',
          storageBucket: 'applications',
          storagePath: 'generated-documents/job/file.pdf',
        },
        status: 'completed',
      })
    );
    mockDownload.mockResolvedValueOnce({
      data: new Blob([Buffer.from('%PDF-result')], { type: 'application/pdf' }),
      error: null,
    });

    const result = await downloadDocumentPdfJobResult(jobId);

    expect(result?.pending).toBe(false);
    expect(result && 'buffer' in result ? result.buffer.toString() : '').toBe('%PDF-result');
    expect(mockDownload).toHaveBeenCalledWith('generated-documents/job/file.pdf');
  });
});
