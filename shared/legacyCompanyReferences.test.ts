import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const legacyPatterns = [
  'MAPLE',
  'Maple Painting',
  'MAPLE PAINTING PTY LTD',
  'Maple Rentals',
  'Aurora',
  'Addlestone',
  '13/27-33',
  'Merrylands',
] as const;

const allowedMention = (file: string, line: string) => {
  if (file === 'AGENTS.md' && line.includes('Do not use Maple')) {
    return true;
  }

  if (file.endsWith('legacyCompanyReferences.test.ts')) {
    return true;
  }

  if (file.endsWith('tollTransferNoticePdf.test.ts') && line.includes('legacyCompanyFragments')) {
    return true;
  }

  if (file.endsWith('tollTransferNoticePdf.test.ts') && line.trim().match(/^['"].*['"],?$/)) {
    return true;
  }

  if (line.includes('not.toContain') || line.includes('not.toMatch')) {
    return true;
  }

  return false;
};

describe('legacy company reference guard', () => {
  it('blocks legacy Maple/Aurora company identity from source, docs, and tests', () => {
    const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .filter((file) =>
        /^(api|src|shared|scripts|docs)\//.test(file) ||
        /^(\.agents\/skills\/maple-rental|\.claude\/skills\/maple-rental|\.github\/agents)\//.test(file) ||
        ['AGENTS.md', 'README.md', '.codex/AGENTS.md', '.env.example', 'env.local.example', 'render.env.example', 'render.yaml', 'DEPLOY_RENDER.md', 'GALA_DEPLOYMENT.md'].includes(file)
      )
      .filter((file) => !file.startsWith('dist/') && !file.startsWith('server-dist/'));

    const violations: string[] = [];
    for (const file of files) {
      const contents = readFileSync(file, 'utf8');
      const lines = contents.split(/\r?\n/);

      lines.forEach((line, index) => {
        const matchedPattern = legacyPatterns.find((pattern) => line.includes(pattern));
        if (matchedPattern && !allowedMention(file, line)) {
          violations.push(`${file}:${index + 1}: ${matchedPattern}: ${line.trim()}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
