import { describe, expect, it } from 'vitest';
import { normalizeProcessEnvironment } from './windows-process-env.mjs';
describe('Windows builder environment', () => {
  it('preserves executable search paths under the exact key Vercel reads', () => {
    const result = normalizeProcessEnvironment({ Path: 'C:\\Windows\\System32;C:\\node', ComSpec: 'C:\\Windows\\System32\\cmd.exe' }, 'win32');
    expect(result.PATH).toBe('C:\\Windows\\System32;C:\\node');
    expect(result).not.toHaveProperty('Path');
    expect(result.ComSpec).toBe('C:\\Windows\\System32\\cmd.exe');
  });
  it('does not alter case-sensitive Linux environment names', () => {
    expect(normalizeProcessEnvironment({ Path: 'custom', PATH: '/usr/bin' }, 'linux')).toEqual({ Path: 'custom', PATH: '/usr/bin' });
  });
});
