import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { normalizeProcessEnvironment } from './windows-process-env.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const project = JSON.parse(readFileSync(path.join(root, '.vercel/project.json'), 'utf8'));
if (project.projectName !== 'galarentals' || project.orgId !== 'team_cJFk6APDaky0rXTTZLj4xoWT') {
  throw new Error('Refusing to run Vercel against an unverified GalaRentals project link.');
}
const args = process.argv.slice(2);
if (args.includes('--prod') || args.some(arg => /^(?:--target(?:=|$))/.test(arg))) {
  throw new Error('This local helper permits Preview only. Production actions require separate authorization.');
}
const candidates = [
  path.join(path.dirname(process.execPath), 'node_modules/vercel/package.json'),
  path.join(root, 'node_modules/vercel/package.json'),
];
const packagePath = candidates.find(existsSync);
if (!packagePath) throw new Error('Install the Vercel CLI for the active Node runtime first.');
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const cli = path.resolve(path.dirname(packagePath), typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.vercel || pkg.bin.vc);
const result = spawnSync(process.execPath, [cli, ...args], {
  cwd: root, env: normalizeProcessEnvironment(process.env), stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
