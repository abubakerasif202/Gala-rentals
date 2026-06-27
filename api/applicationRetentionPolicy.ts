export type ApplicationRetentionCategory = 'rejected' | 'cancelled' | 'expired';

export type ApplicationRetentionRecord = {
  id: string;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  cancelled_at?: string | null;
  intended_start_date?: string | null;
  license_photo?: string | null;
  license_back_photo?: string | null;
  passport_or_uber_profile_screenshot?: string | null;
  proof_of_address_document?: string | null;
  additional_document?: string | null;
};

export const APPLICATION_RETENTION_POLICY = Object.freeze({
  automaticDeletionEnabled: false,
  categories: {
    rejected: { retentionDays: 90 },
    cancelled: { retentionDays: 90 },
    expired: { retentionDays: 30 },
  },
  requiresAdminApproval: true,
  requiresAuditLog: true,
  requiresDocumentCleanup: true,
});

const DAY_MS = 24 * 60 * 60 * 1000;
const DOCUMENT_FIELDS = [
  'license_photo',
  'license_back_photo',
  'passport_or_uber_profile_screenshot',
  'proof_of_address_document',
  'additional_document',
] as const;

const validDate = (value: string | null | undefined) => {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const buildApplicationRetentionDryRun = (
  applications: ApplicationRetentionRecord[],
  now = new Date()
) => {
  const nowTimestamp = now.getTime();

  return applications.flatMap((application) => {
    let category: ApplicationRetentionCategory | null = null;
    let basisTimestamp: number | null = null;

    if (application.status === 'Rejected') {
      category = 'rejected';
      basisTimestamp = validDate(application.updated_at) ?? validDate(application.created_at);
    } else if (application.status === 'Cancelled') {
      category = 'cancelled';
      basisTimestamp = validDate(application.cancelled_at) ?? validDate(application.updated_at);
    } else if (['Pending', 'Approved'].includes(application.status)) {
      category = 'expired';
      basisTimestamp = validDate(application.intended_start_date);
    }

    if (!category || basisTimestamp == null) return [];
    const retentionDays = APPLICATION_RETENTION_POLICY.categories[category].retentionDays;
    const eligibleAt = basisTimestamp + retentionDays * DAY_MS;
    if (eligibleAt > nowTimestamp) return [];

    return [{
      applicationId: application.id,
      category,
      eligibleAt: new Date(eligibleAt).toISOString(),
      documentPaths: DOCUMENT_FIELDS.map((field) => application[field]).filter(
        (value): value is string => Boolean(value)
      ),
      dryRun: true as const,
      requiresAdminApproval: true as const,
      requiresAuditLog: true as const,
      requiresDocumentCleanup: true as const,
    }];
  });
};
