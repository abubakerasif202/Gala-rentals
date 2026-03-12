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
  return spec?.definitions?.cars?.properties?.modelYear ? 'camel' : 'snake';
};

export const mapCarPayloadForSchema = (car, coreMode) =>
  coreMode === 'camel'
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

export const mapApplicationPayloadForSchema = (application, coreMode) =>
  coreMode === 'camel'
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
        assignedCarId: application.assigned_car_id,
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
        assigned_car_id: application.assigned_car_id,
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

export const mapRentalPayloadForSchema = (rental, coreMode) =>
  coreMode === 'camel'
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

export const getCarSelectList = (coreMode) =>
  coreMode === 'camel'
    ? 'id, name, modelYear, weeklyPrice, bond, status, image, created_at'
    : 'id, name, model_year, weekly_price, bond, status, image, created_at';

export const getApplicationSelectList = (coreMode) =>
  coreMode === 'camel'
    ? 'id, name, email, experience, licenseNumber, assignedCarId, status'
    : 'id, name, email, experience, license_number, assigned_car_id, status';

export const getRentalSelectList = (coreMode) =>
  coreMode === 'camel'
    ? 'id, carId, applicationId, startDate, weeklyPrice, status'
    : 'id, car_id, application_id, start_date, weekly_price, status';

export const extractRegistrationFromCar = (car) => {
  const name = String(car?.name || '');
  const registrationMatch = /\(([A-Z0-9]+)\)\s*$/.exec(name);
  return registrationMatch ? canonicalizeRegistration(registrationMatch[1]) : null;
};

export const getApplicationAssignedCarId = (application, coreMode) =>
  coreMode === 'camel' ? application.assignedCarId ?? null : application.assigned_car_id ?? null;

export const getApplicationLicenseNumber = (application, coreMode) =>
  coreMode === 'camel' ? application.licenseNumber ?? '' : application.license_number ?? '';

export const getRentalCarId = (rental, coreMode) =>
  coreMode === 'camel' ? rental.carId : rental.car_id;
