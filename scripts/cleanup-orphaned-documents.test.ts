import { describe, expect, it, vi } from 'vitest';

const mockCreateClient = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

import {
  APPLICATION_DOCUMENT_COLUMNS,
  CLEANUP_CONFIRMATION,
  assertDestructiveCleanupConfirmed,
  extractApplicationStoragePath,
  isOlderThanMinimumOrphanAge,
  loadReferencedDocumentPaths,
  runCleanup,
} from './cleanup-orphaned-documents';

describe('orphaned application document cleanup', () => {
  it('recognizes current and legacy document columns', () => {
    expect(APPLICATION_DOCUMENT_COLUMNS).toEqual(expect.arrayContaining([
      'license_photo', 'license_back_photo', 'passport_or_uber_profile_screenshot',
      'proof_of_address_document', 'additional_document', 'uber_screenshot',
    ]));
  });

  it('preserves nested storage paths from signed URLs', () => {
    expect(extractApplicationStoragePath(
      'https://example.supabase.co/storage/v1/object/sign/applications/private/a.pdf?token=x'
    )).toBe('private/a.pdf');
  });

  it('requires an exact confirmation before deletion', () => {
    expect(() => assertDestructiveCleanupConfirmed(false)).not.toThrow();
    expect(() => assertDestructiveCleanupConfirmed(true, 'yes')).toThrow(/requires --confirm/);
  });

  it('only treats timestamped files older than 24 hours as cleanup candidates', () => {
    const now = new Date('2026-06-30T00:00:00.000Z');
    expect(isOlderThanMinimumOrphanAge({
      path: 'old.pdf',
      updatedAt: '2026-06-28T23:59:59.000Z',
    }, now)).toBe(true);
    expect(isOlderThanMinimumOrphanAge({
      path: 'recent.pdf',
      updatedAt: '2026-06-29T12:00:00.000Z',
    }, now)).toBe(false);
    expect(isOlderThanMinimumOrphanAge({
      path: 'unknown.pdf',
      updatedAt: null,
    }, now)).toBe(false);
  });

  it('skips unavailable compatibility columns without losing current references', async () => {
    const select = vi.fn((column: string) => ({
      range: () => column === 'license_photo'
        ? Promise.resolve({ data: [{ license_photo: 'front.jpg' }], error: null })
        : Promise.resolve({ data: null, error: { code: '42703', message: 'column does not exist' } }),
    }));
    const supabase = { from: () => ({ select }) };
    await expect(loadReferencedDocumentPaths(supabase)).resolves.toEqual(new Set(['front.jpg']));
  });

  it('dry-runs only old unreferenced application files', async () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const bucket = {
      list: vi.fn(async () => ({
        data: [
          { id: '1', name: 'referenced.pdf', updated_at: oldDate },
          { id: '2', name: 'old-orphan.pdf', updated_at: oldDate },
          { id: '3', name: 'recent-orphan.pdf', updated_at: recentDate },
          { id: '4', name: 'unknown-orphan.pdf' },
        ],
        error: null,
      })),
      remove: vi.fn(),
    };
    const supabase = {
      from: () => ({
        select: (column: string) => ({
          range: () => column === 'license_photo'
            ? Promise.resolve({ data: [{ license_photo: 'referenced.pdf' }], error: null })
            : Promise.resolve({ data: [], error: null }),
        }),
      }),
      storage: {
        from: () => bucket,
      },
    };
    mockCreateClient.mockReturnValue(supabase as any);

    try {
      await expect(runCleanup()).resolves.toMatchObject({
        apply: false,
        deletedCount: 0,
        orphanedFiles: ['old-orphan.pdf'],
      });
      expect(bucket.remove).not.toHaveBeenCalled();
    } finally {
      if (previousUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    }
  });

  it('dry-runs lifecycle retention without deleting storage files or updating applications', async () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const remove = vi.fn();
    const update = vi.fn();
    const bucket = {
      list: vi.fn(async () => ({ data: [], error: null })),
      remove,
    };
    const application = {
      id: '11111111-1111-4111-8111-111111111111',
      status: 'Paid',
      paid_at: oldDate,
      documents_purged_at: null,
      license_photo: 'private/license-front.png',
      license_back_photo: 'private/license-back.png',
      proof_of_address_document: 'private/proof.pdf',
    };
    const supabase = {
      from: () => ({
        select: (columns: string) => ({
          range: () =>
            columns.includes('documents_purged_at')
              ? Promise.resolve({ data: [application], error: null })
              : Promise.resolve({ data: [], error: null }),
        }),
        update,
      }),
      storage: { from: () => bucket },
    };
    mockCreateClient.mockReturnValue(supabase as any);

    try {
      const result = await runCleanup();

      expect(result.apply).toBe(false);
      expect(result.lifecyclePurgedCount).toBe(0);
      expect(result.retentionPlan).toHaveLength(1);
      expect(result.retentionPlan[0]).toMatchObject({
        applicationId: application.id,
        category: 'verified_sensitive_documents',
        dryRun: true,
      });
      expect(remove).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    } finally {
      if (previousUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    }
  });

  it('purges eligible sensitive documents, marks metadata, and is safe to retry', async () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const remove = vi.fn(async (paths: string[]) => ({
      data: paths.map((name) => ({ name })),
      error: null,
    }));
    const bucket = {
      list: vi.fn(async () => ({ data: [], error: null })),
      remove,
    };
    const application: Record<string, any> = {
      id: '22222222-2222-4222-8222-222222222222',
      status: 'Paid',
      paid_at: oldDate,
      documents_purged_at: null,
      license_photo: 'private/license-front.png',
      license_back_photo: 'private/license-back.png',
      passport_or_uber_profile_screenshot: null,
      proof_of_address_document: 'private/proof.pdf',
      additional_document: null,
    };
    const updatePayloads: Array<Record<string, any>> = [];
    const supabase = {
      from: () => ({
        select: (columns: string) => ({
          range: () =>
            columns.includes('documents_purged_at')
              ? Promise.resolve({ data: [application], error: null })
              : Promise.resolve({ data: [], error: null }),
        }),
        update: (payload: Record<string, any>) => {
          updatePayloads.push(payload);
          return {
            eq: (_column: string, id: string) => ({
              is: () => ({
                select: () => ({
                  maybeSingle: async () => {
                    if (application.id !== id || application.documents_purged_at) {
                      return { data: null, error: null };
                    }
                    Object.assign(application, payload);
                    return { data: { id }, error: null };
                  },
                }),
              }),
            }),
          };
        },
      }),
      storage: { from: () => bucket },
    };
    mockCreateClient.mockReturnValue(supabase as any);

    try {
      const first = await runCleanup({
        apply: true,
        confirmation: CLEANUP_CONFIRMATION,
      });
      const second = await runCleanup({
        apply: true,
        confirmation: CLEANUP_CONFIRMATION,
      });

      expect(first.lifecyclePurgedCount).toBe(1);
      expect(remove).toHaveBeenCalledTimes(1);
      expect(remove).toHaveBeenCalledWith([
        'private/license-front.png',
        'private/license-back.png',
        'private/proof.pdf',
      ]);
      expect(updatePayloads[0]).toMatchObject({
        license_photo: null,
        license_back_photo: null,
        proof_of_address_document: null,
      });
      expect(updatePayloads[0].documents_purged_at).toEqual(expect.any(String));
      expect(updatePayloads[0].document_retention_metadata).toMatchObject({
        category: 'verified_sensitive_documents',
        document_count: 3,
        field_names: [
          'license_photo',
          'license_back_photo',
          'proof_of_address_document',
        ],
        policy_version: 1,
      });
      expect(updatePayloads[0].document_retention_metadata.path_hashes).toHaveLength(3);
      expect(updatePayloads[0].document_retention_metadata.path_hashes).not.toContain(
        'private/license-front.png'
      );
      expect(application.license_photo).toBeNull();
      expect(application.document_retention_metadata.path_hashes[0]).toMatch(/^[a-f0-9]{64}$/);
      expect(second.lifecyclePurgedCount).toBe(0);
      expect(remove).toHaveBeenCalledTimes(1);
    } finally {
      if (previousUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    }
  });
});
