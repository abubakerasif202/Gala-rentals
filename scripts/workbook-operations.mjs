import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import { getWorkbookImportPaths } from './fleet-sync-source.js';
import { normalizeProcessEnvironment } from './windows-process-env.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const validateWorkbookOperation = (args, environment, platform = process.platform) => {
  if (platform !== 'win32') throw new Error('Workbook operations require the authorized Windows workstation and Excel installation.');
  const apply = args.includes('--apply');
  const confirmed = args.includes('--confirm=GALA_WORKBOOK_SYNC_APPROVED');
  if (apply && !confirmed) throw new Error('Workbook writes require explicit operator confirmation.');
  if (environment.ALLOW_LEGACY_IMPORT?.toLowerCase() === 'true') throw new Error('Scheduled workbook operations cannot import legacy snapshots.');
  const url = new URL(environment.SUPABASE_URL || '');
  if (url.hostname !== 'pdvvoentidzomdxxvzvk.supabase.co' && !args.some(arg => arg === `--staging-project=${url.hostname.split('.')[0]}`)) {
    throw new Error('Workbook operations require the GalaRentals production identity or an explicitly verified staging project.');
  }
  return { apply, paths: getWorkbookImportPaths(environment) };
};

export const runWorkbookOperation = async (args = process.argv.slice(2)) => {
  const envFile = args.find(arg => arg.startsWith('--env-file='))?.slice('--env-file='.length);
  if (!envFile) throw new Error('Provide --env-file with a private GalaRentals configuration file.');
  const environment = { ...process.env, ...parse(fs.readFileSync(envFile)), GALA_FLEET_SOURCE: 'workbook' };
  const operation = validateWorkbookOperation(args, environment);
  const missing = Object.values(operation.paths).filter(file => !fs.existsSync(file));
  if (missing.length) {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'Required workbook files are missing.', missing, writesPerformed: false }));
    return 2;
  }
  const locks = path.join(root, '.vercel/operations');
  fs.mkdirSync(locks, { recursive: true });
  const lockPath = path.join(locks, 'workbook.lock');
  let descriptor;
  try { descriptor = fs.openSync(lockPath, 'wx'); }
  catch { throw new Error('Another workbook operation holds the lock. Verify the previous process before recovering a stale lock.'); }
  fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  try {
    const options = { cwd: root, env: normalizeProcessEnvironment({ ...environment, ALLOW_LEGACY_IMPORT: 'false' }), encoding: 'utf8', windowsHide: true, timeout: 20 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 };
    if (!operation.apply) {
      // Extraction only: never invoke the importer's destructive -Apply branch.
      const result = spawnSync('powershell.exe', ['-NoProfile', '-File', path.join(root, 'scripts/import-fleet-from-workbooks.ps1'), '-FleetPath', operation.paths.fleetPath, '-InvoicePath', operation.paths.invoicePath, '-ClientPath', operation.paths.clientPath, '-EmitPayload'], options);
      if (result.error || result.status !== 0) throw new Error('Workbook extraction failed. Verify Excel, file permissions and workbook format. No payload was logged.');
      const payload = JSON.parse(result.stdout.trim().replace(/^\uFEFF/, ''));
      console.log(JSON.stringify({ status: 'PASS', mode: 'dry-run', cars: payload.cars?.length || 0, applications: payload.applications?.length || 0, rentals: payload.rentals?.length || 0, writesPerformed: false }));
      return 0;
    }
    const tsxPackage = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/tsx/package.json'), 'utf8'));
    const tsxCli = path.resolve(root, 'node_modules/tsx', typeof tsxPackage.bin === 'string' ? tsxPackage.bin : tsxPackage.bin.tsx);
    const result = spawnSync(process.execPath, [tsxCli, path.join(root, 'scripts/sync-realtime-fleet.js')], options);
    if (result.error || result.status !== 0) throw new Error('Approved workbook synchronization failed; inspect the database state before retrying. Output is suppressed to protect customer information.');
    console.log(JSON.stringify({ status: 'PASS', mode: 'approved-apply', writesPerformed: true }));
    return 0;
  } finally { fs.closeSync(descriptor); fs.unlinkSync(lockPath); }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runWorkbookOperation().then(code => { process.exitCode = code; }).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
