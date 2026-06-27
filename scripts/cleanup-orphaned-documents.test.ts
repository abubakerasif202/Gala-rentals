import { describe, expect, it, vi } from 'vitest';
import {
  APPLICATION_DOCUMENT_COLUMNS,
  assertDestructiveCleanupConfirmed,
  extractApplicationStoragePath,
  loadReferencedDocumentPaths,
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

  it('skips unavailable compatibility columns without losing current references', async () => {
    const select = vi.fn((column: string) => ({
      range: () => column === 'license_photo'
        ? Promise.resolve({ data: [{ license_photo: 'front.jpg' }], error: null })
        : Promise.resolve({ data: null, error: { code: '42703', message: 'column does not exist' } }),
    }));
    const supabase = { from: () => ({ select }) };
    await expect(loadReferencedDocumentPaths(supabase)).resolves.toEqual(new Set(['front.jpg']));
  });
});
