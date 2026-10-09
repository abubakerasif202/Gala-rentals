import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import { normalizeProcessEnvironment } from './windows-process-env.mjs';
import { X509Certificate } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const file = process.argv[2];
if (!file) throw new Error('Provide the private GalaRentals production configuration path.');
const project = JSON.parse(fs.readFileSync(path.join(root, '.vercel/project.json'), 'utf8'));
if (project.projectName !== 'galarentals' || project.orgId !== 'team_cJFk6APDaky0rXTTZLj4xoWT') throw new Error('Wrong Vercel project link.');
const input = parse(fs.readFileSync(file));
if (process.argv[3]) {
  const certificate = new X509Certificate(fs.readFileSync(process.argv[3]));
  if (!certificate.ca || new Date(certificate.validTo).getTime() <= Date.now()) throw new Error('The supplied PostgreSQL root certificate is invalid or expired.');
  input.POSTGRES_SSL_CA = certificate.toString();
}
if (new URL(input.SUPABASE_URL).hostname !== 'pdvvoentidzomdxxvzvk.supabase.co') throw new Error('Wrong GalaRentals Supabase project.');
for (const key of ['DATABASE_URL', 'SUPABASE_DB_URL']) {
  if (input[key] && !new URL(input[key]).username.includes('pdvvoentidzomdxxvzvk') && !new URL(input[key]).hostname.includes('pdvvoentidzomdxxvzvk')) throw new Error(`${key} does not identify the GalaRentals database.`);
}
const packagePath = path.join(path.dirname(process.execPath), 'node_modules/vercel/package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const cli = path.resolve(path.dirname(packagePath), typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.vercel || pkg.bin.vc);
const environment = normalizeProcessEnvironment(process.env);
const invoke = (args, value) => spawnSync(process.execPath, [cli, ...args, '--scope', 'abubakerasif202s-projects'], {
  cwd: root, env: environment, encoding: 'utf8', input: value, stdio: ['pipe', 'pipe', 'pipe'],
});
const inspection = invoke(['project', 'inspect', '--non-interactive']);
if (inspection.status !== 0 || !(inspection.stdout + inspection.stderr).includes('galarentals')) throw new Error('Vercel project inspection failed.');
const keys = ['ADMIN_EMAIL', 'APP_URL', 'PUBLIC_SITE_URL', 'SITE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_VEHICLE_IMAGES_BUCKET', 'DATABASE_URL', 'SUPABASE_DB_URL', 'POSTGRES_SSL_CA', 'JWT_SECRET', 'CHECKOUT_LINK_SECRET', 'INDEXNOW_KEY', 'VITE_API_BASE_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const values = { ...input, GALA_CRON_ENABLED: 'false', INDEXNOW_ENABLED: 'false' };
const configured = [], skipped = [];
for (const key of [...keys, 'GALA_CRON_ENABLED', 'INDEXNOW_ENABLED']) {
  const value = values[key]?.trim();
  if (!value || /REPLACE|PASTE_|your_|change_me|\.\.\.|<.*>/i.test(value)) { skipped.push(key); continue; }
  if (['APP_URL', 'PUBLIC_SITE_URL', 'SITE_URL'].includes(key) && new URL(value).origin !== 'https://www.galarentals.com.au') throw new Error(`${key} must use the canonical GalaRentals production origin.`);
  if (['JWT_SECRET', 'CHECKOUT_LINK_SECRET'].includes(key) && value.length < 32) throw new Error(`${key} must have at least 32 characters.`);
  const publicConfig = key.startsWith('VITE_') || ['ADMIN_EMAIL','APP_URL','PUBLIC_SITE_URL','SITE_URL','SUPABASE_URL','SUPABASE_VEHICLE_IMAGES_BUCKET','INDEXNOW_KEY','GALA_CRON_ENABLED','INDEXNOW_ENABLED'].includes(key);
  const result = invoke(['env', 'add', key, 'production', '--yes', '--force', publicConfig ? '--no-sensitive' : '--sensitive'], value);
  if (result.status !== 0) throw new Error(`Vercel failed to configure ${key}; response suppressed to protect secrets.`);
  configured.push(key);
}
console.log(JSON.stringify({ target: 'Production', configured, skipped, deploymentPerformed: false }, null, 2));
