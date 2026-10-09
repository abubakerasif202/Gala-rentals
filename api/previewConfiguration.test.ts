import { describe, expect, it } from 'vitest';
import { getPreviewConfigurationIssues } from './previewConfiguration.js';
const staging = {
  STRIPE_SECRET_KEY: 'sk_test_synthetic', SUPABASE_URL: 'https://gala-staging.supabase.co',
  GALA_STAGING_SUPABASE_URL: 'https://gala-staging.supabase.co',
  DATABASE_URL: 'postgresql://postgres.gala-staging:synthetic@pooler.supabase.com:5432/postgres',
};
describe('preview target isolation', () => {
  it('accepts matching test-mode credentials and an isolated staging project', () => expect(getPreviewConfigurationIssues(staging)).toEqual([]));
  it('rejects the real production project even when copied into the staging marker', () => {
    const url = 'https://pdvvoentidzomdxxvzvk.supabase.co';
    expect(getPreviewConfigurationIssues({ ...staging, SUPABASE_URL: url, GALA_STAGING_SUPABASE_URL: url })).toContain('Production Supabase cannot be used by a writable preview.');
  });
  it('rejects a production database hidden behind a staging storage target', () => {
    expect(getPreviewConfigurationIssues({ ...staging, DATABASE_URL: 'postgresql://postgres.pdvvoentidzomdxxvzvk:synthetic@pooler.supabase.com:5432/postgres' })).toContain('Production PostgreSQL cannot be used by a writable preview.');
  });
  it('requires test Stripe, controlled email and disabled indexing/cron', () => {
    expect(getPreviewConfigurationIssues({ ...staging, STRIPE_SECRET_KEY: 'sk_live_synthetic', RESEND_API_KEY: 'synthetic', INDEXNOW_ENABLED: 'true', GALA_CRON_ENABLED: 'true' })).toHaveLength(4);
  });
});
