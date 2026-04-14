import {
  buildFleetCarSeedRows,
  buildFleetDriverSeedRows,
  canonicalizeRegistration,
  REALTIME_FLEET_ROWS,
} from './realtime-fleet-data.js';
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

async function syncRealtimeFleet() {
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
  const fleetRegistrations = new Set(
    REALTIME_FLEET_ROWS.map((row) => canonicalizeRegistration(row.registration))
  );

  const legacyApplicationIds = currentApplications
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

  const legacyApplicationIdSet = new Set(legacyApplicationIds);
  const legacyRentalIds = currentRentals
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

  const registrationToCar = new Map();

  for (const car of currentCars) {
    const registration = extractRegistrationFromCar(car);

    if (registration) {
      registrationToCar.set(registration, car);
    }
  }

  const carPayloadByRegistration = new Map(
    REALTIME_FLEET_ROWS.map((row, index) => [
      canonicalizeRegistration(row.registration),
      buildFleetCarSeedRows()[index],
    ])
  );

  const updatedCarIds = [];
  const insertedCars = [];

  for (const row of REALTIME_FLEET_ROWS) {
    const registration = canonicalizeRegistration(row.registration);
    const existingCar = registrationToCar.get(registration);
    const carPayload = mapCarPayloadForSchema(
      carPayloadByRegistration.get(registration),
      coreMode
    );

    if (existingCar) {
      // Exclude `image` from updates — images are managed via Supabase Storage and
      // must not be overwritten with the local-path placeholder used for new-car inserts.
      const { image: _image, ...carUpdatePayload } = carPayload;
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

  const protectedCarIds = new Set(
    currentApplications
      .filter((application) => !legacyApplicationIdSet.has(application.id))
      .map((application) => getApplicationAssignedCarId(application, coreMode))
      .filter(Boolean)
  );

  const protectedRentalCarIds = new Set(
    currentRentals
      .filter((rental) => !legacyRentalIds.includes(rental.id))
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

  console.log(
    JSON.stringify(
      {
        coreMode,
        updatedCars: updatedCarIds.length,
        insertedCars: insertedCars.length,
        deletedCars: deletedRegistrations.length,
        skippedDeletions,
        importedApplications: applications.length,
        importedRentals: rentals.length,
        totals: {
          cars: summaryResult[0].count ?? 0,
          applications: summaryResult[1].count ?? 0,
          rentals: summaryResult[2].count ?? 0,
        },
      },
      null,
      2
    )
  );
}

syncRealtimeFleet().catch((error) => {
  console.error('Realtime fleet sync failed.');
  console.error(error);
  process.exit(1);
});
