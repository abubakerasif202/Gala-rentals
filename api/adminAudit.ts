import type express from 'express';

import { db } from './db/index.js';

export type AdminAuditEvent = {
  action: string;
  actor?: string | null;
  applicationId?: string | null;
  metadata?: Record<string, unknown>;
  newStatus?: string | null;
  oldStatus?: string | null;
};

export const getAdminActor = (req: express.Request) =>
  typeof req.admin?.email === 'string' ? req.admin.email : null;

export const recordAdminAuditEvent = async ({
  action,
  actor,
  applicationId,
  metadata = {},
  newStatus,
  oldStatus,
}: AdminAuditEvent) => {
  const { error } = await db.from('admin_audit_events').insert([
    {
      action,
      actor: actor || null,
      application_id: applicationId || null,
      metadata,
      new_status: newStatus || null,
      old_status: oldStatus || null,
    },
  ]);

  if (error) {
    console.warn('Failed to record admin audit event', {
      action,
      applicationId: applicationId || null,
      reason: error.message,
    });
  }
};
