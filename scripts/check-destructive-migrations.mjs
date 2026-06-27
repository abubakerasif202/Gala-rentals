import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = dirname(scriptsDirectory);
const migrationsDirectory = join(rootDirectory, 'supabase', 'migrations');
const baseline = JSON.parse(
  await readFile(join(scriptsDirectory, 'destructive-migration-baseline.json'), 'utf8')
);
const destructiveSql = /^\s*DROP\s+TABLE\b/im;
const localResetMarker = /^\s*--\s*migration-safety:\s*local-reset-only\s*$/im;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const failures = [];
for (const filename of (await readdir(migrationsDirectory)).filter((name) => name.endsWith('.sql'))) {
  const sql = await readFile(join(migrationsDirectory, filename), 'utf8');
  if (!destructiveSql.test(sql)) continue;

  const expectedHash = baseline[filename];
  const explicitLocalReset = /(?:reset|test)/i.test(filename) && localResetMarker.test(sql);
  if (!explicitLocalReset && (!expectedHash || expectedHash !== sha256(sql))) {
    failures.push(filename);
  }
}

if (failures.length > 0) {
  console.error('Unguarded destructive forward migration detected:');
  failures.forEach((filename) => console.error(`- ${filename}`));
  console.error('Do not baseline a new DROP TABLE. Use an additive migration or an explicitly isolated local test reset.');
  process.exit(1);
}

console.log('Migration safety check passed. Legacy destructive snapshots remain hash-pinned and must not be replayed.');
