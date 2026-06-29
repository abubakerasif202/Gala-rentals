import './load-env.js';
import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';

const APPLICATIONS_BUCKET = 'applications';
export const CLEANUP_CONFIRMATION = 'DELETE ORPHANED APPLICATION DOCUMENTS';
export const MIN_ORPHAN_AGE_HOURS = 24;
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

export const runCleanup = async ({ apply = false, confirmation }: { apply?: boolean; confirmation?: string } = {}) => {
  assertDestructiveCleanupConfirmed(apply, confirmation);
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const bucket = supabase.storage.from(APPLICATIONS_BUCKET);
  const [files, referencedPaths] = await Promise.all([
    listAllStorageFiles(bucket),
    loadReferencedDocumentPaths(supabase),
  ]);
  const unreferencedFiles = files.filter((file) => !referencedPaths.has(file.path));
  const orphanedFiles = unreferencedFiles
    .filter((file) => isOlderThanMinimumOrphanAge(file))
    .map((file) => file.path);
  const skippedRecentOrUnknownCount = unreferencedFiles.length - orphanedFiles.length;

  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${files.length} stored, ${referencedPaths.size} referenced, ${orphanedFiles.length} orphaned older than ${MIN_ORPHAN_AGE_HOURS}h, ${Math.max(skippedRecentOrUnknownCount, 0)} skipped as recent or timestamp-unknown.`);
  if (!apply || orphanedFiles.length === 0) {
    return { apply, orphanedFiles, deletedCount: 0, skippedRecentOrUnknownCount };
  }

  let deletedCount = 0;
  for (let index = 0; index < orphanedFiles.length; index += 100) {
    const batch = orphanedFiles.slice(index, index + 100);
    const { data, error } = await bucket.remove(batch);
    if (error) throw new Error(`Failed to delete orphan batch: ${error.message}`);
    deletedCount += data?.length || 0;
  }
  return { apply, orphanedFiles, deletedCount, skippedRecentOrUnknownCount };
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
