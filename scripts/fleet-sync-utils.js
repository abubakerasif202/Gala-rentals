import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

import { canonicalizeRegistration } from './realtime-fleet-data.js';

dotenv.config();

export const createSupabaseAdminClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  return {
    supabase: createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }),
    supabaseUrl,
    supabaseServiceRoleKey,
  };
};

export const getCoreSchemaMode = async ({ supabaseUrl, supabaseServiceRoleKey }) => {
  const response = await fetch(new URL('/rest/v1/', supabaseUrl), {
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      Accept: 'application/openapi+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to inspect Supabase schema: ${response.status} ${response.statusText}`);
  }

  const spec = await response.json();
  const definitions = spec?.definitions || {};
  const getTableMode = (table, camelProperty) =>
    definitions?.[table]?.properties?.[camelProperty] ? 'camel' : 'snake';
  const applicationProperties = definitions?.applications?.properties || {};
  const applicationAssignedCarColumn = applicationProperties.assignedCarId
    ? 'assignedCarId'
    : applicationProperties.assigned_car_id
      ? 'assigned_car_id'
      : null;

  return {
    applications: {
      assignedCarColumn: applicationAssignedCarColumn,
      approvedVehicleColumn: applicationProperties.approvedVehicle
        ? 'approvedVehicle'
        : applicationProperties.approved_vehicle
          ? 'approved_vehicle'
          : null,
      legacyIdColumn: applicationProperties.legacyId
        ? 'legacyId'
        : applicationProperties.legacy_id
          ? 'legacy_id'
          : null,
      mode: getTableMode('applications', 'licenseNumber'),
    },
    cars: getTableMode('cars', 'modelYear'),
    rentals: {
      legacyApplicationColumn: definitions?.rentals?.properties?.legacyApplicationId
        ? 'legacyApplicationId'
        : definitions?.rentals?.properties?.legacy_application_id
          ? 'legacy_application_id'
          : null,
      mode: getTableMode('rentals', 'carId'),
    },
  };
};

const getTableSchema = (schemaMode, table) => {
  if (typeof schemaMode === 'string') {
    return {
      assignedCarColumn:
        table === 'applications'
          ? schemaMode === 'camel'
            ? 'assignedCarId'
            : 'assigned_car_id'
          : null,
      legacyApplicationColumn:
        table === 'rentals'
          ? schemaMode === 'camel'
            ? 'legacyApplicationId'
            : 'legacy_application_id'
          : null,
      legacyIdColumn:
        table === 'applications'
          ? schemaMode === 'camel'
            ? 'legacyId'
            : 'legacy_id'
          : null,
      mode: schemaMode,
    };
  }

  const tableSchema = schemaMode?.[table];
  if (typeof tableSchema === 'string') {
    return {
      assignedCarColumn:
        table === 'applications'
          ? tableSchema === 'camel'
            ? 'assignedCarId'
            : 'assigned_car_id'
          : null,
      legacyApplicationColumn:
        table === 'rentals'
          ? tableSchema === 'camel'
            ? 'legacyApplicationId'
            : 'legacy_application_id'
          : null,
      legacyIdColumn:
        table === 'applications'
          ? tableSchema === 'camel'
            ? 'legacyId'
            : 'legacy_id'
          : null,
      mode: tableSchema,
    };
  }

  return tableSchema || { mode: 'snake' };
};

const getSchemaMode = (schemaMode, table) =>
  getTableSchema(schemaMode, table).mode || 'snake';

export const mapCarPayloadForSchema = (car, coreMode) =>
  getSchemaMode(coreMode, 'cars') === 'camel'
    ? {
        name: car.name,
        modelYear: car.model_year,
        weeklyPrice: car.weekly_price,
        bond: car.bond,
        status: car.status,
        image: car.image,
      }
    : {
        name: car.name,
        model_year: car.model_year,
        weekly_price: car.weekly_price,
        bond: car.bond,
        status: car.status,
        image: car.image,
      };

export const mapApplicationPayloadForSchema = (application, coreMode) => {
  const applicationSchema = getTableSchema(coreMode, 'applications');
  const payload =
    getSchemaMode(coreMode, 'applications') === 'camel'
      ? {
        name: application.name,
        phone: application.phone,
        email: application.email,
        licenseNumber: application.license_number,
        licenseExpiry: application.license_expiry,
        uberStatus: application.uber_status,
        experience: application.experience,
        address: application.address,
        weeklyBudget: application.weekly_budget,
        intendedStartDate: application.intended_start_date,
        status: application.status,
        approvedBond: application.approved_bond,
        approvedWeeklyPrice: application.approved_weekly_price,
        approvedAt: application.approved_at,
        paidAt: application.paid_at,
        paymentLinkVersion: application.payment_link_version,
        paymentLinkSentAt: application.payment_link_sent_at,
        pendingCheckoutSessionId: application.pending_checkout_session_id,
        licensePhoto: null,
        uberScreenshot: null,
      }
      : {
        name: application.name,
        phone: application.phone,
        email: application.email,
        license_number: application.license_number,
        license_expiry: application.license_expiry,
        uber_status: application.uber_status,
        experience: application.experience,
        address: application.address,
        weekly_budget: application.weekly_budget,
        intended_start_date: application.intended_start_date,
        status: application.status,
        approved_bond: application.approved_bond,
        approved_weekly_price: application.approved_weekly_price,
        approved_at: application.approved_at,
        paid_at: application.paid_at,
        payment_link_version: application.payment_link_version,
        payment_link_sent_at: application.payment_link_sent_at,
        pending_checkout_session_id: application.pending_checkout_session_id,
        license_photo: null,
        license_back_photo: null,
      };

  if (applicationSchema.assignedCarColumn) {
    payload[applicationSchema.assignedCarColumn] = application.assigned_car_id;
  }

  if (applicationSchema.legacyIdColumn && application.legacy_id != null) {
    payload[applicationSchema.legacyIdColumn] = application.legacy_id;
  }

  if (applicationSchema.approvedVehicleColumn) {
    payload[applicationSchema.approvedVehicleColumn] = application.approved_vehicle ?? null;
  }

  return payload;
};

export const mapRentalPayloadForSchema = (rental, coreMode) =>
  {
    const rentalSchema = getTableSchema(coreMode, 'rentals');
    const payload =
      getSchemaMode(coreMode, 'rentals') === 'camel'
        ? {
        carId: rental.car_id,
        applicationId: rental.application_id,
        startDate: rental.start_date,
        endDate: rental.end_date ?? null,
        weeklyPrice: rental.weekly_price,
        bondPaid: rental.bond_paid ?? 0,
        status: rental.status,
      }
        : {
        car_id: rental.car_id,
        application_id: rental.application_id,
        start_date: rental.start_date,
        end_date: rental.end_date ?? null,
        weekly_price: rental.weekly_price,
        bond_paid: rental.bond_paid ?? 0,
        status: rental.status,
      };

    if (rentalSchema.legacyApplicationColumn && rental.legacy_application_id != null) {
      payload[rentalSchema.legacyApplicationColumn] = rental.legacy_application_id;
    }

    return payload;
  };

export const getCarSelectList = (coreMode) =>
  getSchemaMode(coreMode, 'cars') === 'camel'
    ? 'id, name, modelYear, weeklyPrice, bond, status, image, created_at'
    : 'id, name, model_year, weekly_price, bond, status, image, created_at';

export const getApplicationSelectList = (coreMode) => {
  const applicationSchema = getTableSchema(coreMode, 'applications');
  const baseSelect =
    getSchemaMode(coreMode, 'applications') === 'camel'
      ? ['id', 'name', 'email', 'experience', 'licenseNumber', 'status']
      : ['id', 'name', 'email', 'experience', 'license_number', 'status'];

  if (applicationSchema.assignedCarColumn) {
    baseSelect.push(applicationSchema.assignedCarColumn);
  }

  if (applicationSchema.approvedVehicleColumn) {
    baseSelect.push(applicationSchema.approvedVehicleColumn);
  }

  return baseSelect.join(', ');
};

export const getRentalSelectList = (coreMode) =>
  getSchemaMode(coreMode, 'rentals') === 'camel'
    ? 'id, carId, applicationId, startDate, weeklyPrice, status'
    : 'id, car_id, application_id, start_date, weekly_price, status';

export const extractRegistrationFromCar = (car) => {
  const name = String(car?.name || '');
  const registrationMatch = /\(([A-Z0-9]+)\)\s*$/.exec(name);
  return registrationMatch ? canonicalizeRegistration(registrationMatch[1]) : null;
};

export const getApplicationAssignedCarId = (application, coreMode) =>
  getTableSchema(coreMode, 'applications').assignedCarColumn
    ? getSchemaMode(coreMode, 'applications') === 'camel'
      ? application.assignedCarId ?? null
      : application.assigned_car_id ?? null
    : null;

export const getApplicationApprovedVehicle = (application, coreMode) => {
  const approvedVehicleColumn = getTableSchema(coreMode, 'applications').approvedVehicleColumn;

  if (!approvedVehicleColumn) {
    return '';
  }

  return String(application[approvedVehicleColumn] || '');
};

export const getApplicationLicenseNumber = (application, coreMode) =>
  getSchemaMode(coreMode, 'applications') === 'camel'
    ? application.licenseNumber ?? ''
    : application.license_number ?? '';

export const getRentalCarId = (rental, coreMode) =>
  getSchemaMode(coreMode, 'rentals') === 'camel' ? rental.carId : rental.car_id;

export const getRentalApplicationId = (rental, coreMode) =>
  getSchemaMode(coreMode, 'rentals') === 'camel' ? rental.applicationId : rental.application_id;
