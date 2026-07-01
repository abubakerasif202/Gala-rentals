import './load-env.js';
import { createClient } from '@supabase/supabase-js';
import type { WebSocketLikeConstructor } from '@supabase/realtime-js';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';
import {
  buildApplicationRetentionDryRun,
  type ApplicationRetentionPlanItem,
  type ApplicationRetentionRecord,
} from '../api/applicationRetentionPolicy.js';

const APPLICATIONS_BUCKET = 'applications';
export const CLEANUP_CONFIRMATION = 'DELETE ORPHANED APPLICATION DOCUMENTS';
export const MIN_ORPHAN_AGE_HOURS = 24;
const realtimeTransport = WebSocket as unknown as WebSocketLikeConstructor;
export const APPLICATION_DOCUMENT_COLUMNS = [
  'license_photo',
  'licensePhoto',
  'license_back_photo',
  'licenseBackPhoto',
  'passport_or_uber_profile_screenshot',
  'passportOrUberProfileScreenshot',
  'proof_of_address_document',
  'proofOfAddressDocument',
  'additional_document',
  'additionalDocument',
  'uber_screenshot',
  'uberScreenshot',
] as const;

const STORAGE_PATH_MARKERS = [
  `/storage/v1/object/public/${APPLICATIONS_BUCKET}/`,
  `/storage/v1/object/sign/${APPLICATIONS_BUCKET}/`,
  `/object/public/${APPLICATIONS_BUCKET}/`,
  `/object/sign/${APPLICATIONS_BUCKET}/`,
];

export type ApplicationStorageFile = {
  path: string;
  updatedAt: string | null;
};

export const extractApplicationStoragePath = (urlOrPath: unknown) => {
  const value = String(urlOrPath || '').trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, '');

  try {
    const pathname = new URL(value).pathname;
    const marker = STORAGE_PATH_MARKERS.find((candidate) => pathname.includes(candidate));
    if (!marker) return null;
    return decodeURIComponent(pathname.slice(pathname.indexOf(marker) + marker.length));
  } catch {
    return null;
  }
};

const getStorageFileUpdatedAt = (entry: Record<string, any>) => {
  const value =
    entry.updated_at ||
    entry.created_at ||
    entry.last_accessed_at ||
    entry.metadata?.lastModified ||
    entry.metadata?.last_modified ||
    null;

  return typeof value === 'string' && value.trim() ? value : null;
};

export const isOlderThanMinimumOrphanAge = (
  file: ApplicationStorageFile,
  now = new Date(),
) => {
  if (!file.updatedAt) return false;
  const updatedAt = new Date(file.updatedAt);
  if (Number.isNaN(updatedAt.getTime())) return false;
  return now.getTime() - updatedAt.getTime() >= MIN_ORPHAN_AGE_HOURS * 60 * 60 * 1000;
};

const isMissingColumnError = (error: { code?: string; message?: string } | null) =>
  Boolean(
    error &&
      (['42703', 'PGRST204'].includes(String(error.code || '')) ||
        /column .* does not exist|could not find.*column/i.test(String(error.message || '')))
  );

const APPLICATION_RETENTION_SELECT_COLUMNS = [
  'id',
  'status',
  'approved_at',
  'created_at',
  'updated_at',
  'cancelled_at',
  'intended_start_date',
  'paid_at',
  'documents_purged_at',
  'license_photo',
  'license_back_photo',
  'passport_or_uber_profile_screenshot',
  'proof_of_address_document',
  'additional_document',
].join(', ');

export const loadReferencedDocumentPaths = async (supabase: any) => {
  const referencedPaths = new Set<string>();
  let availableColumnCount = 0;

  for (const column of APPLICATION_DOCUMENT_COLUMNS) {
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('applications')
        .select(column)
        .range(offset, offset + pageSize - 1);
      if (error) {
        if (offset === 0 && isMissingColumnError(error)) break;
        throw new Error(`Failed to read applications.${column}: ${error.message || 'Unknown error'}`);
      }

      if (offset === 0) availableColumnCount += 1;
      for (const row of data || []) {
        const path = extractApplicationStoragePath(row[column]);
        if (path) referencedPaths.add(path);
      }
      if ((data || []).length < pageSize) break;
    }
  }

  if (availableColumnCount === 0) {
    throw new Error('No known application document columns were available; refusing cleanup.');
  }

  return referencedPaths;
};

export const loadRetentionCandidateApplications = async (supabase: any) => {
  const rows: ApplicationRetentionRecord[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('applications')
      .select(APPLICATION_RETENTION_SELECT_COLUMNS)
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(
        `Failed to read application retention candidates: ${error.message || 'Unknown error'}`
      );
    }

    rows.push(...((data || []) as ApplicationRetentionRecord[]));
    if ((data || []).length < pageSize) break;
  }

  return rows;
};

export const listAllStorageFiles = async (bucket: any, prefix = ''): Promise<ApplicationStorageFile[]> => {
  const files: ApplicationStorageFile[] = [];
  const folders: string[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await bucket.list(prefix, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`Failed to list storage prefix ${prefix || '/'}: ${error.message}`);
    const entries = data || [];
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.name === '.emptyFolderPlaceholder') continue;
      if (entry.id || entry.metadata) {
        files.push({ path, updatedAt: getStorageFileUpdatedAt(entry) });
      }
      else folders.push(path);
    }
    if (entries.length < pageSize) break;
  }

  for (const folder of folders) {
    files.push(...(await listAllStorageFiles(bucket, folder)));
  }
  return files;
};

export const assertDestructiveCleanupConfirmed = (apply: boolean, confirmation?: string) => {
  if (apply && confirmation !== CLEANUP_CONFIRMATION) {
    throw new Error(`Destructive cleanup requires --confirm="${CLEANUP_CONFIRMATION}".`);
  }
};

const purgeApplicationDocuments = async ({
  bucket,
  planItem,
  supabase,
}: {
  bucket: any;
  planItem: ApplicationRetentionPlanItem;
  supabase: any;
}) => {
  const storagePaths = planItem.documentPaths
    .map(extractApplicationStoragePath)
    .filter((path): path is string => Boolean(path));

  if (storagePaths.length > 0) {
    const { error } = await bucket.remove(storagePaths);
    if (error) {
      throw new Error(`Failed to delete retained application document batch: ${error.message}`);
    }
  }

  const { data, error } = await supabase
    .from('applications')
    .update(planItem.updatePayload)
    .eq('id', planItem.applicationId)
    .is('documents_purged_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to mark application documents purged: ${error.message || 'Unknown error'}`
    );
  }

  return Boolean(data?.id);
};

export const runCleanup = async ({ apply = false, confirmation }: { apply?: boolean; confirmation?: string } = {}) => {
  assertDestructiveCleanupConfirmed(apply, confirmation);
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
    realtime: {
      transport: realtimeTransport,
    },
  });
  const bucket = supabase.storage.from(APPLICATIONS_BUCKET);
  const [files, referencedPaths] = await Promise.all([
    listAllStorageFiles(bucket),
    loadReferencedDocumentPaths(supabase),
  ]);
  const retentionCandidates = await loadRetentionCandidateApplications(supabase);
  const retentionPlan = buildApplicationRetentionDryRun(retentionCandidates, new Date(), {
    dryRun: !apply,
  });
  const unreferencedFiles = files.filter((file) => !referencedPaths.has(file.path));
  const orphanedFiles = unreferencedFiles
    .filter((file) => isOlderThanMinimumOrphanAge(file))
    .map((file) => file.path);
  const skippedRecentOrUnknownCount = unreferencedFiles.length - orphanedFiles.length;

  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${files.length} stored, ${referencedPaths.size} referenced, ${orphanedFiles.length} orphaned older than ${MIN_ORPHAN_AGE_HOURS}h, ${retentionPlan.length} lifecycle purge candidates, ${Math.max(skippedRecentOrUnknownCount, 0)} skipped as recent or timestamp-unknown.`);
  if (!apply) {
    return {
      apply,
      orphanedFiles,
      retentionPlan,
      deletedCount: 0,
      lifecyclePurgedCount: 0,
      skippedRecentOrUnknownCount,
    };
  }

  let deletedCount = 0;
  for (let index = 0; index < orphanedFiles.length; index += 100) {
    const batch = orphanedFiles.slice(index, index + 100);
    const { data, error } = await bucket.remove(batch);
    if (error) throw new Error(`Failed to delete orphan batch: ${error.message}`);
    deletedCount += data?.length || 0;
  }

  let lifecyclePurgedCount = 0;
  for (const planItem of retentionPlan) {
    const purged = await purgeApplicationDocuments({ bucket, planItem, supabase });
    if (purged) lifecyclePurgedCount += 1;
  }

  return {
    apply,
    orphanedFiles,
    retentionPlan,
    deletedCount,
    lifecyclePurgedCount,
    skippedRecentOrUnknownCount,
  };
};

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const apply = process.argv.includes('--apply');
  const confirmationArg = process.argv.find((argument) => argument.startsWith('--confirm='));
  runCleanup({ apply, confirmation: confirmationArg?.slice('--confirm='.length) }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
