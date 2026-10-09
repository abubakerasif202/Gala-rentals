import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.vercel/output');
const functionDir = path.join(output, 'functions/gala.func');
await rm(output, { recursive: true, force: true });
await mkdir(functionDir, { recursive: true });
await cp(path.join(root, 'dist'), path.join(output, 'static'), { recursive: true });

// PDFKit loads font assets relative to its own package. Keep its dependency tree
// in the private function, while bundling the rest of the application.
const copied = new Set();
const copyPackage = async (name, from = root) => {
  const require = createRequire(path.join(from, 'package.json'));
  let directory = path.dirname(require.resolve(name));
  while (true) {
    try {
      const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
      if (pkg.name === name) {
        if (copied.has(name)) return;
        copied.add(name);
        await cp(directory, path.join(functionDir, 'node_modules', name), { recursive: true });
        for (const dep of Object.keys(pkg.dependencies || {})) await copyPackage(dep, directory);
        return;
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error(`Unable to locate ${name} package assets.`);
    directory = parent;
  }
};
await copyPackage('pdfkit');
await cp(path.join(root, 'public/forms'), path.join(functionDir, 'public/forms'), { recursive: true });
await build({
  entryPoints: [path.join(root, 'serverless/handler.ts')],
  outfile: path.join(functionDir, 'handler.mjs'),
  bundle: true, platform: 'node', target: 'node22', format: 'esm',
  external: ['pdfkit', 'vite'], sourcemap: false,
  banner: { js: "import { createRequire as galaCreateRequire } from 'node:module'; const require = galaCreateRequire(import.meta.url);" },
  define: { 'process.env.VERCEL': '"1"' },
});
await writeFile(path.join(functionDir, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs22.x', handler: 'handler.mjs', launcherType: 'Nodejs',
  shouldAddHelpers: false, shouldAddSourcemapSupport: false,
  supportsResponseStreaming: true, maxDuration: 60, regions: ['syd1'],
}, null, 2));

const csp = "default-src 'self'; script-src 'self' https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://*.supabase.in; frame-src 'self' blob: https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests";
await writeFile(path.join(output, 'config.json'), JSON.stringify({
  version: 3,
  ...(process.env.VERCEL_ENV === 'production' && process.env.GALA_CRON_ENABLED === 'true' ? { crons: [{ path: '/api/cron/maintenance', schedule: '0 17 * * *' }] } : {}),
  routes: [
    { src: '/(.*)', headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': csp, 'Strict-Transport-Security': 'max-age=31536000' }, continue: true },
    { src: '/(.*)', has: [{ type: 'host', value: 'galarentals.com.au' }], headers: { Location: 'https://www.galarentals.com.au/$1' }, status: 308 },
    { src: '/api(?:/.*)?', dest: '/gala', headers: { 'Cache-Control': 'private, no-store' } },
    { src: '/admin/test-indexnow', dest: '/gala' },
    { src: '/[a-f0-9]{32}\\.txt', dest: '/gala' },
    { src: '/assets/(.*)', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
    { handle: 'filesystem' },
    { src: '/(?:|pricing|apply|faq|contact|my-rental|success|checkout/[^/]+|(?:fleet|cars|vehicles)(?:/[^/]+)?|admin/(?:login|dashboard|agreements|toll-notices))/?', methods: ['GET', 'HEAD'], dest: '/index.html', headers: { 'Cache-Control': 'no-store' } },
    { src: '/.*', status: 404 },
  ],
}, null, 2));

const inspectPublicFiles = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inspectPublicFiles(file);
    else if (/\.map$|^\.env|^package(?:-lock)?\.json$|\.(?:ts|tsx)$/.test(entry.name)) throw new Error(`Unsafe public build artifact: ${entry.name}`);
  }
};
await inspectPublicFiles(path.join(output, 'static'));
console.log('Vercel output ready: Vite static files and one private Node 22 Express function in syd1.');
