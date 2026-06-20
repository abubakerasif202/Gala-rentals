import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('migration safety guards', () => {
  it('keeps the local destructive reset migration skipped by default', () => {
    const resetMigration = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/00_reset.sql'),
      'utf8'
    );

    expect(resetMigration).toContain('app.allow_destructive_local_reset');
    expect(resetMigration).toContain('RAISE NOTICE');
    expect(resetMigration).toContain('RETURN;');
    expect(resetMigration).toContain('DROP TABLE IF EXISTS');
  });
});
