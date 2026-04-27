import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';

const shouldUseRelaxedPostgresSsl = (value) => {
  if (!value) {
    return false;
  }

  try {
    return new URL(value).hostname.endsWith('.pooler.supabase.com');
  } catch {
    return value.includes('.pooler.supabase.com');
  }
};

if (!connectionString) {
  console.error('Missing DATABASE_URL or SUPABASE_DB_URL environment variable.');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ...(shouldUseRelaxedPostgresSsl(connectionString)
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL using the provided connection string.');

    const migrationFiles = [
      '20260326111500_ensure_stripe_webhook_event_ledger.sql',
      '20260419090000_add_stripe_webhook_v3_columns.sql',
    ];

    for (const migrationFile of migrationFiles) {
      const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', migrationFile);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      console.log(`Executing supabase/migrations/${migrationFile}...`);
      await client.query(sql);
    }

    console.log('Stripe webhook ledger migrations applied successfully.');
  } catch (error) {
    console.error('Error applying Stripe webhook ledger migration:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

runMigration();
