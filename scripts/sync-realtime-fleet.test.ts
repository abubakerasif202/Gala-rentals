import { describe, expect, it } from 'vitest';

import {
  assertLegacySnapshotImportAllowed,
  isLegacyImportAllowed,
} from './sync-realtime-fleet.js';

describe('sync-realtime-fleet legacy import guard', () => {
  it('requires an explicit legacy import flag before snapshot imports can run', () => {
    expect(isLegacyImportAllowed({})).toBe(false);
    expect(() => assertLegacySnapshotImportAllowed({})).toThrow(/ALLOW_LEGACY_IMPORT=true/);
  });

  it('allows snapshot imports only when ALLOW_LEGACY_IMPORT is exactly true', () => {
    expect(isLegacyImportAllowed({ ALLOW_LEGACY_IMPORT: 'true' })).toBe(true);
    expect(isLegacyImportAllowed({ ALLOW_LEGACY_IMPORT: 'TRUE' })).toBe(true);
    expect(isLegacyImportAllowed({ ALLOW_LEGACY_IMPORT: '1' })).toBe(false);
  });
});
