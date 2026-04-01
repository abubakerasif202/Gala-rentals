import { afterEach, describe, expect, it } from 'vitest';

import {
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
  it('treats a Supabase shared pooler session-mode URL on port 5432 as session-capable', () => {
    process.env.SUPABASE_DB_URL =
      'postgresql://postgres.example:secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';

    expect(getPostgresConnectionMode()).toBe('session');
    expect(hasDirectDatabaseConnection()).toBe(true);
  });

  it('treats a Supabase transaction-pooler URL on port 6543 as non-session', () => {
    process.env.SUPABASE_DB_URL =
      'postgresql://postgres.example:secret@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';

    expect(getPostgresConnectionMode()).toBe('transaction');
    expect(hasDirectDatabaseConnection()).toBe(false);
  });

  it('returns none when no connection string is configured', () => {
    delete process.env.SUPABASE_DB_URL;
    delete process.env.DATABASE_URL;

    expect(getPostgresConnectionMode()).toBe('none');
    expect(hasDirectDatabaseConnection()).toBe(false);
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
