import crypto from 'node:crypto';

export type ApplicationRetentionCategory =
  | 'verified_sensitive_documents'
  | 'rejected'
  | 'cancelled'
  | 'expired_incomplete';

export type ApplicationRetentionRecord = {
  id: string;
  status: string;
  approved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  cancelled_at?: string | null;
  intended_start_date?: string | null;
  paid_at?: string | null;
  documents_purged_at?: string | null;
  license_photo?: string | null;
  license_back_photo?: string | null;
  passport_or_uber_profile_screenshot?: string | null;
  proof_of_address_document?: string | null;
  additional_document?: string | null;
};

export const APPLICATION_RETENTION_POLICY = Object.freeze({
  automaticDeletionEnabled: false,
  categories: {
    verified_sensitive_documents: { retentionDays: 30 },
    rejected: { retentionDays: 90 },
    cancelled: { retentionDays: 90 },
    expired_incomplete: { retentionDays: 30 },
  },
  metadataVersion: 1,
  preservesRawDocumentUrls: false,
  requiresAdminApproval: true,
  requiresAuditLog: true,
  requiresDocumentCleanup: true,
});

const DAY_MS = 24 * 60 * 60 * 1000;
export const APPLICATION_SENSITIVE_DOCUMENT_FIELDS = [
  'license_photo',
  'license_back_photo',
  'passport_or_uber_profile_screenshot',
  'proof_of_address_document',
  'additional_document',
] as const;

export type ApplicationSensitiveDocumentField =
  (typeof APPLICATION_SENSITIVE_DOCUMENT_FIELDS)[number];

export type ApplicationRetentionMetadata = {
  category: ApplicationRetentionCategory;
  document_count: number;
  field_names: ApplicationSensitiveDocumentField[];
  path_hashes: string[];
  policy_version: number;
  purged_at: string;
  retention_days: number;
};

export type ApplicationRetentionPlanItem = {
  applicationId: string;
  category: ApplicationRetentionCategory;
  documentPaths: string[];
  dryRun: boolean;
  eligibleAt: string;
  metadata: ApplicationRetentionMetadata;
  purgeAt: string;
  requiresAdminApproval: true;
  requiresAuditLog: true;
  requiresDocumentCleanup: true;
  updatePayload: Record<string, unknown>;
};

const validDate = (value: string | null | undefined) => {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
};

const hashRetentionPath = (path: string) =>
  crypto.createHash('sha256').update(path).digest('hex');

const getDocumentEntries = (application: ApplicationRetentionRecord) =>
  APPLICATION_SENSITIVE_DOCUMENT_FIELDS.flatMap((field) => {
    const value = application[field];
    return value ? [{ field, path: value }] : [];
  });

const getRetentionBasis = (
  application: ApplicationRetentionRecord
): { basisTimestamp: number; category: ApplicationRetentionCategory } | null => {
  if (application.status === 'Paid' || application.status === 'Payment Review') {
    const basisTimestamp =
      validDate(application.paid_at) ??
      validDate(application.approved_at) ??
      validDate(application.updated_at);
    return basisTimestamp == null
      ? null
      : { basisTimestamp, category: 'verified_sensitive_documents' };
  }

  if (application.status === 'Approved') {
    const basisTimestamp =
      validDate(application.approved_at) ?? validDate(application.updated_at);
    return basisTimestamp == null
      ? null
      : { basisTimestamp, category: 'verified_sensitive_documents' };
  }

  if (application.status === 'Rejected') {
    const basisTimestamp =
      validDate(application.updated_at) ?? validDate(application.created_at);
    return basisTimestamp == null ? null : { basisTimestamp, category: 'rejected' };
  }

  if (application.status === 'Cancelled') {
    const basisTimestamp =
      validDate(application.cancelled_at) ?? validDate(application.updated_at);
    return basisTimestamp == null ? null : { basisTimestamp, category: 'cancelled' };
  }

  if (application.status === 'Pending') {
    const basisTimestamp = validDate(application.intended_start_date);
    return basisTimestamp == null
      ? null
      : { basisTimestamp, category: 'expired_incomplete' };
  }

  return null;
};

export const buildApplicationRetentionDryRun = (
  applications: ApplicationRetentionRecord[],
  now = new Date(),
  options: { dryRun?: boolean } = {}
) => {
  const nowTimestamp = now.getTime();
  const purgeAt = now.toISOString();
  const dryRun = options.dryRun ?? true;

  return applications.flatMap((application) => {
    if (application.documents_purged_at) return [];
    const retentionBasis = getRetentionBasis(application);
    if (!retentionBasis) return [];

    const { basisTimestamp, category } = retentionBasis;
    const documentEntries = getDocumentEntries(application);
    if (documentEntries.length === 0) return [];

    const retentionDays = APPLICATION_RETENTION_POLICY.categories[category].retentionDays;
    const eligibleAt = basisTimestamp + retentionDays * DAY_MS;
    if (eligibleAt > nowTimestamp) return [];
    const metadata: ApplicationRetentionMetadata = {
      category,
      document_count: documentEntries.length,
      field_names: documentEntries.map(({ field }) => field),
      path_hashes: documentEntries.map(({ path }) => hashRetentionPath(path)),
      policy_version: APPLICATION_RETENTION_POLICY.metadataVersion,
      purged_at: purgeAt,
      retention_days: retentionDays,
    };
    const updatePayload: Record<string, unknown> = {
      document_retention_metadata: metadata,
      documents_purged_at: purgeAt,
    };
    for (const field of APPLICATION_SENSITIVE_DOCUMENT_FIELDS) {
      updatePayload[field] = null;
    }

    return [{
      applicationId: application.id,
      category,
      eligibleAt: new Date(eligibleAt).toISOString(),
      documentPaths: documentEntries.map(({ path }) => path),
      dryRun,
      metadata,
      purgeAt,
      requiresAdminApproval: true as const,
      requiresAuditLog: true as const,
      requiresDocumentCleanup: true as const,
      updatePayload,
    } satisfies ApplicationRetentionPlanItem];
  });
};
