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

  it('plans eligible rejected, cancelled, and expired applications without deleting data', () => {
    const plan = buildApplicationRetentionDryRun([
      { id: 'rejected', status: 'Rejected', updated_at: '2025-01-01T00:00:00.000Z', license_photo: 'a.jpg' },
      { id: 'cancelled', status: 'Cancelled', cancelled_at: '2025-01-01T00:00:00.000Z' },
      { id: 'expired', status: 'Pending', intended_start_date: '2025-01-01' },
      { id: 'paid', status: 'Paid', updated_at: '2020-01-01T00:00:00.000Z' },
    ], new Date('2026-01-01T00:00:00.000Z'));

    expect(plan.map((item) => item.category)).toEqual(['rejected', 'cancelled', 'expired']);
    expect(plan.every((item) => item.dryRun && item.requiresAuditLog)).toBe(true);
    expect(plan[0]?.documentPaths).toEqual(['a.jpg']);
  });
});
