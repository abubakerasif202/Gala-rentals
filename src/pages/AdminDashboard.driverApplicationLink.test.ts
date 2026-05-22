import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..');
const readProjectFile = (path: string) =>
  readFileSync(resolve(root, path), 'utf8');

describe('admin dashboard driver application link', () => {
  it('exposes a private copyable driver application link for admins only', () => {
    const source = readProjectFile('src/pages/AdminDashboard.tsx');

    expect(source).toContain('Driver Application Link');
    expect(source).toContain('Copy Driver Application Link');
    expect(source).toContain('Open Driver Application');
    expect(source).toContain('https://www.maplerentals.com.au/apply');
    expect(source).toContain(
      'Send this private link to drivers when you want them to complete the application form.'
    );
  });
});
