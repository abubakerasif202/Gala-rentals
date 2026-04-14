import './load-env.js';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
if (!connectionString) {
    console.error("Missing DATABASE_URL or SUPABASE_DB_URL environment variable.");
    process.exit(1);
}

const client = new Client({ connectionString });

async function checkStatus() {
    try {
        await client.connect();
        const res = await client.query('SELECT version();');
        console.log("Direct PostgreSQL Status: UP AND RESPONDING!");
        console.log("Version Details:", res.rows[0].version);
    } catch (e) {
        console.error("Direct PostgreSQL Status: CONNECTION FAILED!");
        console.error(e.message);
    } finally {
        await client.end();
    }
}

checkStatus();
