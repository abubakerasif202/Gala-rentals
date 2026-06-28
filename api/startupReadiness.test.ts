import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('production startup readiness', () => {
  it('completes critical database readiness before binding the HTTP port', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'api/index.ts'),
      'utf8'
    );
    const startServer = source.slice(source.indexOf('export const startServer'));

    expect(source).toContain('await ensureDB();');
    expect(source).toContain('await runDirectDBHealthCheck();');
    expect(source).toContain('await validateProductionSchemaContract();');
    expect(startServer.indexOf('await ensureProductionDatabaseReadiness();')).toBeGreaterThan(-1);
    expect(startServer.indexOf('await ensureProductionDatabaseReadiness();')).toBeLessThan(
      startServer.indexOf('app.listen(PORT, HOST')
    );
  });
});
