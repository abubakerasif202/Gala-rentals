import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  PRODUCTION_SCHEMA_CONTRACT_REQUIRED_COLUMNS,
  STRIPE_WEBHOOK_LEDGER_CONTRACTS,
} from './schemaContract.js';

const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
const migrationSql = fs
  .readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith('.sql'))
  .map((fileName) => fs.readFileSync(path.join(migrationsDir, fileName), 'utf8'))
  .join('\n');

const containsSqlIdentifier = (identifier: string) =>
  new RegExp(`\\b${identifier}\\b`, 'i').test(migrationSql);

describe('schema contract migration coverage', () => {
  it('keeps required runtime payment columns represented in migrations', () => {
    for (const requiredColumns of Object.values(
      PRODUCTION_SCHEMA_CONTRACT_REQUIRED_COLUMNS
    )) {
      for (const column of requiredColumns) {
        expect(
          column.acceptable.some((candidate) => containsSqlIdentifier(candidate)),
          `Missing migration coverage for ${column.label}`
        ).toBe(true);
      }
    }
  });

  it('keeps modern Stripe webhook ledger columns represented in migrations', () => {
    const modernLedger = STRIPE_WEBHOOK_LEDGER_CONTRACTS.find(
      (contract) => contract.label === 'modern'
    );

    expect(modernLedger).toBeDefined();
    for (const column of modernLedger?.required || []) {
      expect(
        column.acceptable.some((candidate) => containsSqlIdentifier(candidate)),
        `Missing migration coverage for stripe_webhook_events.${column.label}`
      ).toBe(true);
    }
  });
});
