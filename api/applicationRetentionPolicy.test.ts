import { describe, expect, it } from 'vitest';
import {
  APPLICATION_RETENTION_POLICY,
  buildApplicationRetentionDryRun,
} from './applicationRetentionPolicy.js';

describe('application retention policy', () => {
  it('is non-destructive and requires admin approval, audit, and document cleanup', () => {
    expect(APPLICATION_RETENTION_POLICY).toMatchObject({
      automaticDeletionEnabled: false,
      requiresAdminApproval: true,
      requiresAuditLog: true,
      requiresDocumentCleanup: true,
    });
  });

  it('plans eligible verified, rejected, and expired applications without deleting data', () => {
    const plan = buildApplicationRetentionDryRun([
      { id: 'verified', status: 'Paid', paid_at: '2025-01-01T00:00:00.000Z', license_photo: 'verified.jpg' },
      { id: 'rejected', status: 'Rejected', updated_at: '2025-01-01T00:00:00.000Z', license_photo: 'a.jpg' },
      { id: 'cancelled', status: 'Cancelled', cancelled_at: '2025-01-01T00:00:00.000Z' },
      { id: 'expired', status: 'Pending', intended_start_date: '2025-01-01', proof_of_address_document: 'expired-proof.pdf' },
      { id: 'already-purged', status: 'Paid', paid_at: '2025-01-01T00:00:00.000Z', documents_purged_at: '2025-02-01T00:00:00.000Z', license_photo: 'purged.jpg' },
    ], new Date('2026-01-01T00:00:00.000Z'));

    expect(plan.map((item) => item.category)).toEqual([
      'verified_sensitive_documents',
      'rejected',
      'expired_incomplete',
    ]);
    expect(plan.every((item) => item.dryRun && item.requiresAuditLog)).toBe(true);
    expect(plan[0]?.documentPaths).toEqual(['verified.jpg']);
    expect(plan[0]?.metadata).toMatchObject({
      document_count: 1,
      field_names: ['license_photo'],
      policy_version: 1,
    });
    expect(plan[0]?.metadata.path_hashes[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(plan[0]?.metadata.path_hashes[0]).not.toBe('verified.jpg');
    expect(plan[0]?.updatePayload).toMatchObject({
      license_photo: null,
      license_back_photo: null,
      passport_or_uber_profile_screenshot: null,
      proof_of_address_document: null,
      additional_document: null,
    });
  });
});
