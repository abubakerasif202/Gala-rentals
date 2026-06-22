import {
  buildCarLeaseAgreementFees,
  renderCarLeaseAgreement,
} from './templates/carLeaseAgreement.js';
import { calculateBondFromWeeklyRent } from '../shared/rentalPricing.js';
import { getLeaseAgreementBusinessDetails } from './agreementConfig.js';

const toDateOnly = (value: string) => value.split('T')[0];
const toOptionalString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';
const toNonEmptyString = (value: unknown, fallback: string) =>
  toOptionalString(value) || fallback;

export const buildLeaseAgreementInput = (
  application: Record<string, any>,
  car: Record<string, any> = {},
  approvedWeeklyPrice: number,
  nowIso: string,
  approvedBond = calculateBondFromWeeklyRent(approvedWeeklyPrice)
) => {
  const manualVehicleText = toOptionalString(
    application.assigned_vehicle_text ??
      application.assignedVehicleText ??
      application.assigned_vehicle_rego ??
      application.assignedVehicleRego ??
      application.approved_vehicle ??
      application.approvedVehicle
  );
  const vehicleLabel = manualVehicleText || 'To be assigned';
  const vehicleTokens = vehicleLabel.split(' ').filter(Boolean);
  const vehicleMake = vehicleLabel === 'To be assigned'
    ? 'To be assigned'
    : vehicleTokens[0] || 'Vehicle';
  const weeklyRentText = `$${Number(approvedWeeklyPrice || 0).toFixed(2)} per week`;
  const leaseAgreementBusinessDetails = getLeaseAgreementBusinessDetails();
  const rentalStartDate = toOptionalString(
    application.intended_start_date ?? application.intendedStartDate
  );
  const vehicleVin = toOptionalString(
    application.assigned_vehicle_rego ??
      application.assignedVehicleRego ??
      car.vin ??
      car.vin_number ??
      car.registration ??
      car.car_registration
  );

  return {
    ...leaseAgreementBusinessDetails,
    agreementDate: toDateOnly(nowIso),
    fees: buildCarLeaseAgreementFees(approvedBond),
    renteeName: toNonEmptyString(application.name, 'Driver'),
    renteeDob: toNonEmptyString(
      application.date_of_birth ?? application.dateOfBirth,
      'Not provided'
    ),
    renteeEmail: toNonEmptyString(application.email, 'Not provided'),
    renteeContact: toNonEmptyString(application.phone, 'Not provided'),
    renteeAddress: toNonEmptyString(application.address, 'Not provided'),
    renteeLicenseNumber: toNonEmptyString(
      application.license_number ?? application.licenseNumber,
      'Not provided'
    ),
    renteeLicenseState: toNonEmptyString(
      application.license_state ?? application.licenseState,
      'NSW'
    ),
    vehicleMake,
    vehicleModel: vehicleLabel,
    vehicleYear: car.model_year ? String(car.model_year) : 'Not recorded',
    vehicleVin: vehicleVin || 'To be assigned',
    weeklyRent: weeklyRentText,
    rentalStartDate: rentalStartDate ? toDateOnly(rentalStartDate) : toDateOnly(nowIso),
    rentalEndDate: 'Open-ended',
  };
};

export const renderApplicationLeaseAgreement = (
  application: Record<string, any>,
  car: Record<string, any>,
  approvedWeeklyPrice: number,
  nowIso: string,
  approvedBond = calculateBondFromWeeklyRent(approvedWeeklyPrice)
) =>
  renderCarLeaseAgreement(
    buildLeaseAgreementInput(application, car, approvedWeeklyPrice, nowIso, approvedBond)
  );
