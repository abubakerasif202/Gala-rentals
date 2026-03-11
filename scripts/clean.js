import fs from 'node:fs';

for (const target of ['dist', 'server-dist', 'output', 'tmp', 'server.stdout.log', 'server.stderr.log']) {
  fs.rmSync(target, { recursive: true, force: true });
}
