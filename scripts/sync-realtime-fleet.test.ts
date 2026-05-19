import { describe, expect, it } from 'vitest';

import {
  assertLegacySnapshotImportAllowed,
  isLegacyImportAllowed,
  runRealtimeFleetSync,
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

  it('skips auto fallback runs when workbook files are missing', async () => {
    const summary = await runRealtimeFleetSync({
      mode: 'auto',
      reason: 'Workbook files are missing, so realtime fleet sync will skip this run.',
      source: 'snapshot',
      workbookImport: {
        clientPath: 'C:\\Users\\abuba\\RentalClientList.xlsx',
        fleetPath: 'C:\\Users\\abuba\\Fleets.xlsx',
        invoicePath: 'C:\\Users\\abuba\\Invoice-list.xls',
        isAvailable: false,
        missingFiles: [],
      },
    });

    expect(summary.source).toBe('skip');
    expect(summary.skipped).toBe(true);
    expect(summary.updatedCars).toBe(0);
    expect(summary.importedApplications).toBe(0);
    expect(summary.importedRentals).toBe(0);
  });
});
