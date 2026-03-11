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

    const sqlPath = path.join(process.cwd(), 'supabase-payment-workflow-upgrade.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing supabase-payment-workflow-upgrade.sql...');
    await client.query(sql);
    console.log('Payment workflow schema upgrade applied successfully.');
  } catch (error) {
    console.error('Error applying payment workflow schema upgrade:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

runMigration();
