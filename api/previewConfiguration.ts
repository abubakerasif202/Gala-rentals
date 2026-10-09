const PRODUCTION_PROJECT_REF = 'pdvvoentidzomdxxvzvk';

export const getPreviewConfigurationIssues = (env: Record<string, string | undefined> = process.env) => {
  const issues: string[] = [];
  if (!/^(?:sk|rk)_test_/.test(env.STRIPE_SECRET_KEY || '')) issues.push('Preview requires a Stripe test-mode secret key.');
  if (!env.GALA_STAGING_SUPABASE_URL || env.GALA_STAGING_SUPABASE_URL !== env.SUPABASE_URL) issues.push('Preview requires the verified staging Supabase URL.');
  if (env.SUPABASE_URL?.includes(PRODUCTION_PROJECT_REF)) issues.push('Production Supabase cannot be used by a writable preview.');
  const dsn = env.DATABASE_URL || env.SUPABASE_DB_URL;
  if (!dsn) issues.push('Preview requires a verified staging PostgreSQL connection.');
  else {
    try {
      const database = new URL(dsn);
      if (`${database.username} ${database.hostname}`.includes(PRODUCTION_PROJECT_REF)) issues.push('Production PostgreSQL cannot be used by a writable preview.');
      const stagingRef = new URL(env.GALA_STAGING_SUPABASE_URL || '').hostname.split('.')[0];
      if (stagingRef && new URL(env.GALA_STAGING_SUPABASE_URL || '').hostname.endsWith('.supabase.co') && !`${database.username} ${database.hostname}`.includes(stagingRef)) issues.push('Staging Supabase and PostgreSQL project identities must match.');
    } catch { issues.push('Preview database or Supabase URL is invalid.'); }
  }
  if (env.RESEND_API_KEY && !env.GALA_PREVIEW_EMAIL_TO) issues.push('Preview email requires a controlled recipient inbox.');
  if (env.INDEXNOW_ENABLED === 'true') issues.push('Preview indexing must be disabled.');
  if (env.GALA_CRON_ENABLED === 'true') issues.push('Preview cron must be disabled.');
  return issues;
};
