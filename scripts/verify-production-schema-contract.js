import './load-env.js';

import { verifyProductionSchemaContract } from '../api/schemaContract.js';

process.env.NODE_ENV = 'production';
process.env.VITEST = 'false';

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
