import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  buildFleetCarSeedRows,
  buildFleetDriverSeedRows,
  canonicalizeRegistration,
  REALTIME_FLEET_ROWS,
} from './realtime-fleet-data.js';
import { resolveRealtimeFleetSyncSource } from './fleet-sync-source.js';
import {
  createSupabaseAdminClient,
  extractRegistrationFromCar,
  getApplicationAssignedCarId,
  getApplicationLicenseNumber,
  getApplicationSelectList,
  getCarSelectList,
  getCoreSchemaMode,
  getRentalCarId,
  getRentalSelectList,
  mapApplicationPayloadForSchema,
  mapCarPayloadForSchema,
  mapRentalPayloadForSchema,
} from './fleet-sync-utils.js';

const chunk = (items, size) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const insertInChunks = async ({ supabase, table, rows, select }) => {
  const inserted = [];

  for (const part of chunk(rows, 100)) {
    if (part.length === 0) {
      continue;
    }

    const { data, error } = await supabase.from(table).insert(part).select(select);

    if (error) {
      throw error;
    }

    inserted.push(...(data || []));
  }

  return inserted;
};

const deleteByIds = async ({ supabase, table, ids }) => {
  for (const part of chunk(ids, 100)) {
    if (part.length === 0) {
      continue;
    }

    const { error } = await supabase.from(table).delete().in('id', part);

    if (error) {
      throw error;
    }
  }
};

const IMPORT_WORKBOOK_SCRIPT_PATH = fileURLToPath(
  new URL('./import-fleet-from-workbooks.ps1', import.meta.url)
);

const buildSnapshotCarPayloadByRegistration = () =>
  new Map(
    REALTIME_FLEET_ROWS.map((row, index) => [
      canonicalizeRegistration(row.registration),
      buildFleetCarSeedRows()[index],
    ])
  );

const buildProcessError = (result) => {
  const details = [result.error?.message, result.stderr, result.stdout]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return new Error(details.join('\n\n') || 'Workbook fleet import failed.');
};

const loadWorkbookFleetPayload = (workbookImport) => {
  const powerShellCommand =
    process.env.MAPLE_FLEET_POWERSHELL_BIN || (process.platform === 'win32' ? 'powershell.exe' : 'pwsh');
  const args = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    IMPORT_WORKBOOK_SCRIPT_PATH,
    '-FleetPath',
    workbookImport.fleetPath,
    '-InvoicePath',
    workbookImport.invoicePath,
    '-ClientPath',
    workbookImport.clientPath,
    '-EmitPayload',
  ];

  const result = spawnSync(powerShellCommand, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    throw buildProcessError(result);
  }

  const stdout = String(result.stdout || '').trim();
  if (!stdout) {
    throw new Error('Workbook fleet importer returned no payload.');
  }

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `Workbook fleet importer returned invalid JSON.\n${String(error)}\n\n${stdout}`
    );
  }
};

const buildWorkbookCarPayloadByRegistration = (workbookPayload) => {
  const snapshotPayloadByRegistration = buildSnapshotCarPayloadByRegistration();
  const payloadByRegistration = new Map();
  const workbookCars = workbookPayload?.cars || [];

  if (workbookCars.length === 0) {
    throw new Error('Workbook fleet payload contained no cars.');
  }

  for (const workbookCar of workbookCars) {
    const registration =
      canonicalizeRegistration(workbookCar.registration || extractRegistrationFromCar(workbookCar));

    if (!registration) {
      throw new Error(
        `Workbook fleet payload contained a car without a registration: ${JSON.stringify(workbookCar)}`
      );
    }

    const snapshotCar = snapshotPayloadByRegistration.get(registration);
    payloadByRegistration.set(registration, {
      ...(snapshotCar || {}),
      ...workbookCar,
      bond: Number(workbookCar.bond ?? snapshotCar?.bond ?? 500),
      image: snapshotCar?.image || workbookCar.image,
      model_year: Number(workbookCar.model_year ?? snapshotCar?.model_year ?? 2024),
      name: snapshotCar?.name || workbookCar.name,
      status: workbookCar.status || snapshotCar?.status || 'Available',
      weekly_price: Number(workbookCar.weekly_price ?? snapshotCar?.weekly_price ?? 0),
    });
  }

  return payloadByRegistration;
};

export async function runRealtimeFleetSync(syncSource) {
  const { supabase, supabaseUrl, supabaseServiceRoleKey } = createSupabaseAdminClient();
  const coreMode = await getCoreSchemaMode({ supabaseUrl, supabaseServiceRoleKey });
  const importDate = new Date().toISOString().slice(0, 10);
  const importTimestamp = new Date().toISOString();

  const [carsResult, applicationsResult, rentalsResult] = await Promise.all([
    supabase.from('cars').select(getCarSelectList(coreMode)).order('id', { ascending: true }),
    supabase
      .from('applications')
      .select(getApplicationSelectList(coreMode))
      .order('id', { ascending: true }),
    supabase.from('rentals').select(getRentalSelectList(coreMode)).order('id', { ascending: true }),
  ]);

  if (carsResult.error) {
    throw carsResult.error;
  }

  if (applicationsResult.error) {
    throw applicationsResult.error;
  }

  if (rentalsResult.error) {
    throw rentalsResult.error;
  }

  const currentCars = carsResult.data || [];
  const currentApplications = applicationsResult.data || [];
  const currentRentals = rentalsResult.data || [];
  const fleetCarPayloadByRegistration =
    syncSource.source === 'workbook'
      ? buildWorkbookCarPayloadByRegistration(loadWorkbookFleetPayload(syncSource.workbookImport))
      : buildSnapshotCarPayloadByRegistration();
  const fleetRegistrations = new Set(fleetCarPayloadByRegistration.keys());

  let legacyApplicationIds = [];
  let legacyRentalIds = [];
  let legacyApplicationIdSet = new Set();

  if (syncSource.source === 'snapshot') {
    legacyApplicationIds = currentApplications
      .filter((application) => {
        const email = String(application.email || '').toLowerCase();
        const licenseNumber = String(getApplicationLicenseNumber(application, coreMode) || '');
        const experience = String(application.experience || '');

        return (
          email.endsWith('@example.invalid') ||
          licenseNumber.startsWith('LEGACY-') ||
          experience.includes('Legacy renter import') ||
          experience.includes('Imported from live fleet data')
        );
      })
      .map((application) => application.id);

    legacyApplicationIdSet = new Set(legacyApplicationIds);
    legacyRentalIds = currentRentals
      .filter((rental) =>
        legacyApplicationIdSet.has(coreMode === 'camel' ? rental.applicationId : rental.application_id)
      )
      .map((rental) => rental.id);

    if (legacyRentalIds.length > 0) {
      await deleteByIds({ supabase, table: 'rentals', ids: legacyRentalIds });
    }

    if (legacyApplicationIds.length > 0) {
      await deleteByIds({ supabase, table: 'applications', ids: legacyApplicationIds });
    }
  }

  const registrationToCar = new Map();

  for (const car of currentCars) {
    const registration = extractRegistrationFromCar(car);

    if (registration) {
      registrationToCar.set(registration, car);
    }
  }

  const updatedCarIds = [];
  const insertedCars = [];

  for (const [registration, sourceCarPayload] of fleetCarPayloadByRegistration.entries()) {
    const existingCar = registrationToCar.get(registration);
    const carPayload = mapCarPayloadForSchema(sourceCarPayload, coreMode);

    if (existingCar) {
      const carUpdatePayload =
        syncSource.source === 'workbook'
          ? coreMode === 'camel'
            ? {
                bond: carPayload.bond,
                status: carPayload.status,
                weeklyPrice: carPayload.weeklyPrice,
              }
            : {
                bond: carPayload.bond,
                status: carPayload.status,
                weekly_price: carPayload.weekly_price,
              }
          : (() => {
              // Exclude `image` from updates — images are managed via Supabase Storage and
              // must not be overwritten with the local-path placeholder used for new-car inserts.
              const { image: _image, ...payload } = carPayload;
              return payload;
            })();
      const { error } = await supabase.from('cars').update(carUpdatePayload).eq('id', existingCar.id);

      if (error) {
        throw error;
      }

      updatedCarIds.push(existingCar.id);
      continue;
    }

    const { data, error } = await supabase.from('cars').insert(carPayload).select('id, name').single();

    if (error) {
      throw error;
    }

    insertedCars.push(data);
  }

  const refreshedCarsResult = await supabase
    .from('cars')
    .select(getCarSelectList(coreMode))
    .order('id', { ascending: true });

  if (refreshedCarsResult.error) {
    throw refreshedCarsResult.error;
  }

  const refreshedCars = refreshedCarsResult.data || [];
  const carIdByRegistration = new Map();

  for (const car of refreshedCars) {
    const registration = extractRegistrationFromCar(car);

    if (registration) {
      carIdByRegistration.set(registration, car.id);
    }
  }

  let importedApplications = 0;
  let importedRentals = 0;

  if (syncSource.source === 'snapshot') {
    const { applications, rentals } = buildFleetDriverSeedRows({
      carIdByRegistration,
      importDate,
      importTimestamp,
    });

    const insertedApplications = await insertInChunks({
      supabase,
      table: 'applications',
      rows: applications.map((application) => mapApplicationPayloadForSchema(application, coreMode)),
      select: 'id, email',
    });

    const applicationIdByEmail = new Map(
      insertedApplications.map((application) => [application.email, application.id])
    );

    const rentalRows = rentals.map((rental) => {
      const applicationId = applicationIdByEmail.get(
        `legacy-${rental.registration.toLowerCase()}@example.invalid`
      );
      const carId = carIdByRegistration.get(rental.registration);

      if (!applicationId || !carId) {
        throw new Error(`Missing imported ids for registration ${rental.registration}`);
      }

      return mapRentalPayloadForSchema(
        {
          application_id: applicationId,
          car_id: carId,
          start_date: rental.start_date,
          weekly_price: rental.weekly_price,
          bond_paid: rental.bond_paid,
          status: rental.status,
        },
        coreMode
      );
    });

    await insertInChunks({
      supabase,
      table: 'rentals',
      rows: rentalRows,
      select: 'id',
    });

    importedApplications = applications.length;
    importedRentals = rentals.length;
  }

  const protectedCarIds = new Set(
    currentApplications
      .filter((application) =>
        syncSource.source === 'snapshot' ? !legacyApplicationIdSet.has(application.id) : true
      )
      .map((application) => getApplicationAssignedCarId(application, coreMode))
      .filter(Boolean)
  );

  const protectedRentalCarIds = new Set(
    currentRentals
      .filter((rental) => (syncSource.source === 'snapshot' ? !legacyRentalIds.includes(rental.id) : true))
      .map((rental) => getRentalCarId(rental, coreMode))
  );

  const carsToDelete = refreshedCars.filter((car) => {
    const registration = extractRegistrationFromCar(car);

    if (!registration || fleetRegistrations.has(registration)) {
      return false;
    }

    if (protectedCarIds.has(car.id) || protectedRentalCarIds.has(car.id)) {
      return false;
    }

    return true;
  });

  const deletedRegistrations = [];
  const skippedDeletions = [];

  for (const car of carsToDelete) {
    const registration = extractRegistrationFromCar(car) || String(car.id);
    const { error } = await supabase.from('cars').delete().eq('id', car.id);

    if (error) {
      skippedDeletions.push({ id: car.id, registration, error: error.message });
      continue;
    }

    deletedRegistrations.push(registration);
  }

  const summaryResult = await Promise.all([
    supabase.from('cars').select('id', { count: 'exact', head: true }),
    supabase.from('applications').select('id', { count: 'exact', head: true }),
    supabase.from('rentals').select('id', { count: 'exact', head: true }),
  ]);

  const summary = {
    source: syncSource.source,
    coreMode,
    updatedCars: updatedCarIds.length,
    insertedCars: insertedCars.length,
    deletedCars: deletedRegistrations.length,
    skippedDeletions,
    importedApplications,
    importedRentals,
    totals: {
      cars: summaryResult[0].count ?? 0,
      applications: summaryResult[1].count ?? 0,
      rentals: summaryResult[2].count ?? 0,
    },
  };

  console.info(`[fleet-sync] Sync complete: ${JSON.stringify(summary)}`);
  return summary;
}

export async function syncRealtimeFleet() {
  const syncSource = resolveRealtimeFleetSyncSource();
  console.info(`[fleet-sync] Starting sync: ${syncSource.reason}`);
  return runRealtimeFleetSync(syncSource);
}

// Only run immediately if executed directly
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  syncRealtimeFleet().catch((error) => {
    console.error('Realtime fleet sync failed.');
    console.error(error);
    process.exit(1);
  });
}
