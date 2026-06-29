import { describe, expect, it, vi } from 'vitest';

const mockCreateClient = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

import {
  APPLICATION_DOCUMENT_COLUMNS,
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
});
