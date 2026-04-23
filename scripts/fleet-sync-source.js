import fs from 'node:fs';
import process from 'node:process';

const DEFAULT_WORKBOOK_IMPORT_PATHS = {
  clientPath: 'C:\\Users\\abuba\\RentalClientList.xlsx',
  fleetPath: 'C:\\Users\\abuba\\Fleets.xlsx',
  invoicePath: 'C:\\Users\\abuba\\Invoice-list.xls',
};

const VALID_SYNC_MODES = new Set(['auto', 'snapshot', 'workbook']);

const describeMissingWorkbookFiles = (missingFiles) =>
  missingFiles
    .map(({ label, path }) => `${label} workbook: ${path}`)
    .join('; ');

export const getWorkbookImportPaths = (env = process.env) => ({
  clientPath: String(
    env.MAPLE_FLEET_CLIENT_WORKBOOK_PATH || DEFAULT_WORKBOOK_IMPORT_PATHS.clientPath
  ),
  fleetPath: String(env.MAPLE_FLEET_WORKBOOK_PATH || DEFAULT_WORKBOOK_IMPORT_PATHS.fleetPath),
  invoicePath: String(
    env.MAPLE_FLEET_INVOICE_WORKBOOK_PATH || DEFAULT_WORKBOOK_IMPORT_PATHS.invoicePath
  ),
});

export const resolveRealtimeFleetSyncMode = (value) => {
  const normalized = String(value || 'auto')
    .trim()
    .toLowerCase();

  if (!VALID_SYNC_MODES.has(normalized)) {
    throw new Error(
      `Unsupported MAPLE_FLEET_SOURCE value "${value}". Expected auto, snapshot, or workbook.`
    );
  }

  return normalized;
};

export const resolveRealtimeFleetSyncSource = ({
  env = process.env,
  fileExists = fs.existsSync,
} = {}) => {
  const mode = resolveRealtimeFleetSyncMode(env.MAPLE_FLEET_SOURCE);
  const workbookPaths = getWorkbookImportPaths(env);
  const missingFiles = [
    { key: 'fleetPath', label: 'Fleet', path: workbookPaths.fleetPath },
    { key: 'invoicePath', label: 'Invoice', path: workbookPaths.invoicePath },
    { key: 'clientPath', label: 'Client', path: workbookPaths.clientPath },
  ].filter(({ path }) => !fileExists(path));

  const workbookImport = {
    ...workbookPaths,
    isAvailable: missingFiles.length === 0,
    missingFiles,
  };

  if (mode === 'snapshot') {
    return {
      mode,
      reason: 'MAPLE_FLEET_SOURCE=snapshot forced the static fleet snapshot.',
      source: 'snapshot',
      workbookImport,
    };
  }

  if (mode === 'workbook') {
    if (!workbookImport.isAvailable) {
      throw new Error(
        `MAPLE_FLEET_SOURCE=workbook requires all workbook files. Missing: ${describeMissingWorkbookFiles(
          missingFiles
        )}.`
      );
    }

    return {
      mode,
      reason: 'MAPLE_FLEET_SOURCE=workbook forced the workbook importer.',
      source: 'workbook',
      workbookImport,
    };
  }

  if (workbookImport.isAvailable) {
    return {
      mode,
      reason: 'Workbook files are available, so realtime fleet sync will import from them.',
      source: 'workbook',
      workbookImport,
    };
  }

  return {
    mode,
    reason: `Workbook files are missing, so realtime fleet sync will fall back to the static snapshot. Missing: ${describeMissingWorkbookFiles(
      missingFiles
    )}.`,
    source: 'snapshot',
    workbookImport,
  };
};
