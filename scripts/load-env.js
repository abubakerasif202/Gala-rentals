import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

const cwd = process.cwd();

loadDotenv({ path: path.resolve(cwd, '.env'), quiet: true });

if (process.env.NODE_ENV !== 'production') {
  loadDotenv({
    path: path.resolve(cwd, '.env.local'),
    override: true,
    quiet: true,
  });
}
