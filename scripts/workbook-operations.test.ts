import { describe, expect, it } from 'vitest';
import { validateWorkbookOperation } from './workbook-operations.mjs';
const env = { SUPABASE_URL: 'https://pdvvoentidzomdxxvzvk.supabase.co' };
describe('external workbook operational safety', () => {
  it('defaults to read-only extraction and requires confirmation for writes', () => {
    expect(validateWorkbookOperation([], env, 'win32').apply).toBe(false);
    expect(() => validateWorkbookOperation(['--apply'], env, 'win32')).toThrow('confirmation');
  });
  it('rejects snapshots, unverified project targets and serverless/Linux execution', () => {
    expect(() => validateWorkbookOperation([], { ...env, ALLOW_LEGACY_IMPORT: 'true' }, 'win32')).toThrow('snapshots');
    expect(() => validateWorkbookOperation([], { SUPABASE_URL: 'https://unrelated.supabase.co' }, 'win32')).toThrow('identity');
    expect(() => validateWorkbookOperation([], env, 'linux')).toThrow('Windows');
  });
});
