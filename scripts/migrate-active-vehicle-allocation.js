import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
if (!connectionString) {
  console.error('Missing DATABASE_URL or SUPABASE_DB_URL environment variable.');
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
      '20260424143000_remove_legacy_vehicle_allocation.sql'
    );
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing supabase/migrations/20260424143000_remove_legacy_vehicle_allocation.sql...');
    await client.query(sql);
    console.log('Legacy vehicle allocation contract removed successfully.');
  } catch (error) {
    console.error('Error removing legacy vehicle allocation contract:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

runMigration();
