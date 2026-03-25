import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL environment variable.');
  process.exit(1);
}

const client = new Client({ connectionString });

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL using the provided connection string.');

    const sqlPath = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '20260325172500_upgrade_legacy_snake_case_payment_workflow.sql'
    );
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log(
      'Executing supabase/migrations/20260325172500_upgrade_legacy_snake_case_payment_workflow.sql...'
    );
    await client.query(sql);
    console.log('Legacy snake_case payment workflow upgrade applied successfully.');
  } catch (error) {
    console.error('Error applying legacy snake_case payment workflow upgrade:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

runMigration();
