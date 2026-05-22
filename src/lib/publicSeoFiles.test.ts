import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..');
const readProjectFile = (path: string) =>
  readFileSync(resolve(root, path), 'utf8');

describe('public SEO files', () => {
  it('uses Maple Painting metadata in the static app shell', () => {
    const html = readProjectFile('index.html');

    expect(html).toContain(
      '<title>Maple Painting | Residential & Commercial Painting Sydney</title>'
    );
    expect(html).toContain('residential painting');
    expect(html).toContain('commercial painting');
    expect(html).not.toMatch(/Maple Rentals|car rental|driver application|vehicle subscriptions/i);
  });

  it('only publishes public Maple Painting URLs in the sitemap', () => {
    const sitemap = readProjectFile('public/sitemap.xml');
    const locs = Array.from(sitemap.matchAll(/<loc>(.*?)<\/loc>/g), ([, loc]) => loc);
    const paths = locs.map((loc) => new URL(loc).pathname);

    expect(sitemap).toContain('<loc>https://www.maplerentals.com.au/</loc>');
    expect(paths).toEqual(['/']);
    expect(paths.join('\n')).not.toMatch(
      /admin|apply|application|driver|rental|checkout|success|agreement|toll|cars|pricing/i
    );
  });

  it('disallows private and legacy rental routes in robots.txt', () => {
    const robots = readProjectFile('public/robots.txt');

    [
      '/admin',
      '/admin/',
      '/api/',
      '/apply',
      '/application',
      '/applications/',
      '/driver/',
      '/rental/',
      '/cars',
      '/cars/',
      '/pricing',
      '/checkout',
      '/checkout/',
      '/success',
      '/agreement',
      '/agreements/',
      '/toll',
      '/toll-notices/',
    ].forEach((route) => {
      expect(robots).toContain(`Disallow: ${route}`);
    });
  });
});
