import './load-env.js';
import { createClient } from '@supabase/supabase-js';

const APPLICATIONS_BUCKET = 'applications';

const runCleanup = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  console.log(`Starting cleanup of orphaned files in bucket: ${APPLICATIONS_BUCKET}`);

  // 1. Fetch all files from the bucket
  const { data: files, error: listError } = await supabase.storage
    .from(APPLICATIONS_BUCKET)
    .list('', { limit: 10000 });

  if (listError) {
    console.error('Failed to list files in bucket:', listError);
    process.exit(1);
  }

  if (!files || files.length === 0) {
    console.log('No files found in the bucket. Nothing to clean up.');
    return;
  }

  console.log(`Found ${files.length} total files in bucket.`);

  // 2. Fetch all referenced file paths from applications
  // Need to account for various schema formats (snake/camel case)
  const { data: applications, error: dbError } = await supabase
    .from('applications')
    .select('license_photo, license_back_photo, licensePhoto, licenseBackPhoto, uber_screenshot, uberScreenshot');

  if (dbError) {
    console.error('Failed to fetch applications:', dbError);
    process.exit(1);
  }

  const referencedPaths = new Set<string>();

  const extractPath = (urlOrPath: string | null | undefined) => {
    if (!urlOrPath) return null;
    try {
      if (urlOrPath.startsWith('http')) {
        const url = new URL(urlOrPath);
        // Extract the filename from the end of the URL
        const parts = url.pathname.split('/');
        return decodeURIComponent(parts[parts.length - 1]);
      }
      return urlOrPath; // Already a relative path/filename
    } catch {
      return urlOrPath;
    }
  };

  for (const app of (applications || [])) {
    const photo1 = extractPath(app.license_photo || app.licensePhoto);
    if (photo1) referencedPaths.add(photo1);

    const photo2 = extractPath(
      app.license_back_photo ||
        app.licenseBackPhoto ||
        app.uber_screenshot ||
        app.uberScreenshot
    );
    if (photo2) referencedPaths.add(photo2);
  }

  console.log(`Found ${referencedPaths.size} referenced files in the database.`);

  // 3. Identify orphans
  const orphanedFiles = files
    .filter(file => file.name !== '.emptyFolderPlaceholder' && !referencedPaths.has(file.name))
    .map(file => file.name);

  if (orphanedFiles.length === 0) {
    console.log('No orphaned files found. Cleanup complete.');
    return;
  }

  console.log(`Found ${orphanedFiles.length} orphaned files to delete.`);

  // 4. Delete orphans in batches to avoid URL length/payload limits
  const batchSize = 100;
  let deletedCount = 0;

  for (let i = 0; i < orphanedFiles.length; i += batchSize) {
    const batch = orphanedFiles.slice(i, i + batchSize);
    console.log(`Deleting batch ${i / batchSize + 1}...`);
    
    const { data: deleteData, error: deleteError } = await supabase.storage
      .from(APPLICATIONS_BUCKET)
      .remove(batch);

    if (deleteError) {
      console.error(`Failed to delete batch ${i / batchSize + 1}:`, deleteError);
    } else {
      deletedCount += deleteData?.length || 0;
    }
  }

  console.log(`Cleanup complete. Successfully deleted ${deletedCount} orphaned files.`);
};

runCleanup().catch((err) => {
  console.error('Unexpected error during cleanup:', err);
  process.exit(1);
});
