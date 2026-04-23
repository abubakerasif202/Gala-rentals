import { describe, expect, it } from 'vitest';

import {
  getWorkbookImportPaths,
  resolveRealtimeFleetSyncSource,
} from './fleet-sync-source.js';

describe('resolveRealtimeFleetSyncSource', () => {
  it('prefers the workbook importer in auto mode when all workbook files exist', () => {
    const result = resolveRealtimeFleetSyncSource({
      env: {},
      fileExists: () => true,
    });

    expect(result.source).toBe('workbook');
    expect(result.workbookImport.isAvailable).toBe(true);
    expect(result.workbookImport.missingFiles).toEqual([]);
  });

  it('falls back to the snapshot sync in auto mode when any workbook file is missing', () => {
    const { fleetPath, clientPath, invoicePath } = getWorkbookImportPaths({});
    const result = resolveRealtimeFleetSyncSource({
      env: {},
      fileExists: (path) => path !== invoicePath,
    });

    expect(result.source).toBe('snapshot');
    expect(result.workbookImport.isAvailable).toBe(false);
    expect(result.workbookImport.missingFiles).toEqual([
      {
        key: 'invoicePath',
        label: 'Invoice',
        path: invoicePath,
      },
    ]);
    expect(result.reason).toContain(invoicePath);
    expect(result.workbookImport.fleetPath).toBe(fleetPath);
    expect(result.workbookImport.clientPath).toBe(clientPath);
  });

  it('keeps snapshot mode when forced even if workbook files are present', () => {
    const result = resolveRealtimeFleetSyncSource({
      env: { MAPLE_FLEET_SOURCE: 'snapshot' },
      fileExists: () => true,
    });

    expect(result.source).toBe('snapshot');
    expect(result.reason).toContain('MAPLE_FLEET_SOURCE=snapshot');
  });

  it('throws when workbook mode is forced but required files are missing', () => {
    expect(() =>
      resolveRealtimeFleetSyncSource({
        env: { MAPLE_FLEET_SOURCE: 'workbook' },
        fileExists: () => false,
      })
    ).toThrow(/MAPLE_FLEET_SOURCE=workbook requires all workbook files/i);
  });
});
