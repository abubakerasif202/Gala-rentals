import {
  buildCarLeaseAgreementFees,
  renderCarLeaseAgreement,
} from './templates/carLeaseAgreement.js';
import { calculateBondFromWeeklyRent } from '../shared/rentalPricing.js';

const toDateOnly = (value: string) => value.split('T')[0];

export const buildLeaseAgreementInput = (
  application: Record<string, any>,
  car: Record<string, any>,
  approvedWeeklyPrice: number,
  nowIso: string,
  approvedBond = calculateBondFromWeeklyRent(approvedWeeklyPrice)
) => {
  const carName = String(car.name || 'Vehicle');
  const carTokens = carName.split(' ').filter(Boolean);
  const vehicleMake = carTokens[0] || 'Vehicle';
  const weeklyRentText = `$${Number(approvedWeeklyPrice || 0).toFixed(2)} per week`;

  return {
    agreementDate: toDateOnly(nowIso),
    fees: buildCarLeaseAgreementFees(approvedBond),
    renteeName: application.name,
    renteeEmail: application.email,
    renteeContact: application.phone,
    renteeAddress: application.address,
    renteeLicenseNumber: application.license_number,
    renteeLicenseState: application.license_state || 'NSW',
    vehicleMake,
    vehicleModel: carName,
    vehicleYear: car.model_year ? String(car.model_year) : '',
    weeklyRent: weeklyRentText,
    rentalStartDate: application.intended_start_date || toDateOnly(nowIso),
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
