import { afterEach, describe, expect, it } from 'vitest';

import {
  getSessionModePostgresRequirementIssue,
  getPostgresConnectionMode,
  hasDirectDatabaseConnection,
  shouldUseRelaxedPostgresSsl,
} from './postgres.js';

const originalSupabaseDbUrl = process.env.SUPABASE_DB_URL;
const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (typeof originalSupabaseDbUrl === 'string') {
    process.env.SUPABASE_DB_URL = originalSupabaseDbUrl;
  } else {
    delete process.env.SUPABASE_DB_URL;
  }

  if (typeof originalDatabaseUrl === 'string') {
    process.env.DATABASE_URL = originalDatabaseUrl;
  } else {
    delete process.env.DATABASE_URL;
  }
});

describe('postgres connection mode detection', () => {
  it('prefers DATABASE_URL over SUPABASE_DB_URL when both are configured', () => {
    process.env.DATABASE_URL =
      'postgresql://postgres:secret@render-postgres.internal:5432/render_app';
    process.env.SUPABASE_DB_URL =
      'postgresql://postgres.example:secret@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';

    expect(getPostgresConnectionMode()).toBe('session');
    expect(hasDirectDatabaseConnection()).toBe(true);
  });

  it('treats a Supabase shared pooler session-mode URL on port 5432 as session-capable', () => {
    delete process.env.DATABASE_URL;
    process.env.SUPABASE_DB_URL =
      'postgresql://postgres.example:secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';

    expect(getPostgresConnectionMode()).toBe('session');
    expect(hasDirectDatabaseConnection()).toBe(true);
  });

  it('treats a Supabase transaction-pooler URL on port 6543 as non-session', () => {
    delete process.env.DATABASE_URL;
    process.env.SUPABASE_DB_URL =
      'postgresql://postgres.example:secret@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';

    expect(getPostgresConnectionMode()).toBe('transaction');
    expect(hasDirectDatabaseConnection()).toBe(false);
  });

  it('treats non-Supabase hosts on port 6543 as session-capable', () => {
    delete process.env.DATABASE_URL;
    process.env.SUPABASE_DB_URL =
      'postgresql://postgres:secret@db.internal.example.com:6543/app';

    expect(getPostgresConnectionMode()).toBe('session');
    expect(hasDirectDatabaseConnection()).toBe(true);
  });

  it('treats malformed strings that only mention Supabase pooler tokens as session-capable', () => {
    delete process.env.DATABASE_URL;
    process.env.SUPABASE_DB_URL =
      'invalid connection text .pooler.supabase.com:6543';

    expect(getPostgresConnectionMode()).toBe('session');
    expect(hasDirectDatabaseConnection()).toBe(true);
  });

  it('still detects transaction mode for malformed Supabase DSNs on 6543', () => {
    delete process.env.DATABASE_URL;
    process.env.SUPABASE_DB_URL =
      'postgresql://postgres:bad%zz@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';

    expect(getPostgresConnectionMode()).toBe('transaction');
    expect(hasDirectDatabaseConnection()).toBe(false);
  });

  it('returns none when no connection string is configured', () => {
    delete process.env.SUPABASE_DB_URL;
    delete process.env.DATABASE_URL;

    expect(getPostgresConnectionMode()).toBe('none');
    expect(hasDirectDatabaseConnection()).toBe(false);
  });

  it('does not report a session-mode production issue for a direct 5432 URL', () => {
    process.env.DATABASE_URL =
      'postgresql://postgres:secret@render-postgres.internal:5432/render_app';
    delete process.env.SUPABASE_DB_URL;

    expect(getSessionModePostgresRequirementIssue()).toBeNull();
  });

  it('reports a session-mode production issue for Supabase transaction pooler 6543', () => {
    delete process.env.DATABASE_URL;
    process.env.SUPABASE_DB_URL =
      'postgresql://postgres.example:secret@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';

    expect(getSessionModePostgresRequirementIssue()).toContain(
      'transaction-mode Postgres'
    );
    expect(getSessionModePostgresRequirementIssue()).toContain('port 6543');
  });

  it('reports a session-mode production issue when direct Postgres is missing', () => {
    delete process.env.SUPABASE_DB_URL;
    delete process.env.DATABASE_URL;

    expect(getSessionModePostgresRequirementIssue()).toContain(
      'DATABASE_URL or SUPABASE_DB_URL'
    );
  });

  it('uses relaxed SSL settings for Supabase pooler hosts', () => {
    expect(
      shouldUseRelaxedPostgresSsl(
        'postgresql://postgres.example:secret@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres'
      )
    ).toBe(true);
  });

  it('does not force relaxed SSL for non-Supabase hosts', () => {
    expect(
      shouldUseRelaxedPostgresSsl(
        'postgresql://postgres:secret@db.internal.example.com:5432/app'
      )
    ).toBe(false);
  });
});
