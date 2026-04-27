import path from 'node:path';

import { config as loadDotenv } from 'dotenv';

process.env.NODE_ENV = 'production';
process.env.VITEST = 'false';

loadDotenv({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const { verifyProductionSchemaContract } = await import('../api/schemaContract.js');

async function runVerification() {
  try {
    console.log('Verifying production schema contract...');
    await verifyProductionSchemaContract();
    console.log('Production schema contract verified successfully.');
  } catch (error) {
    console.error('Production schema contract verification failed:', error);
    process.exitCode = 1;
  }
}

runVerification();
