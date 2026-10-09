import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPostgresConnectionOptions } from './postgres.js';
afterEach(() => vi.unstubAllEnvs());
describe('Vercel Supabase TLS configuration', () => {
  const url = 'postgresql://postgres.gala-staging:synthetic@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=no-verify';
  it('fails closed when the official root certificate has not been configured', () => {
    vi.stubEnv('VERCEL', '1');vi.stubEnv('POSTGRES_SSL_CA', '');
    expect(() => getPostgresConnectionOptions(url)).toThrow('POSTGRES_SSL_CA');
  });
  it('cannot let URL parameters override certificate verification', () => {
    vi.stubEnv('VERCEL', '1');vi.stubEnv('POSTGRES_SSL_CA', 'local-certificate-fixture\\n');
    const options = getPostgresConnectionOptions(url);
    expect(options.connectionString).not.toContain('sslmode');
    expect(options.ssl).toEqual({ rejectUnauthorized: true, ca: 'local-certificate-fixture\n' });
  });
  it('preserves local PostgreSQL connections and existing standalone server behavior', () => {
    vi.stubEnv('VERCEL', '');
    expect(getPostgresConnectionOptions(url).ssl).toEqual({ rejectUnauthorized: false });
    expect(getPostgresConnectionOptions('postgresql://postgres:synthetic@127.0.0.1:55472/galarentals_staging').ssl).toBeUndefined();
  });
});
