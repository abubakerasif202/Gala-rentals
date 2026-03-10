import { z } from 'zod';

import {
  AUSTRALIAN_MOBILE_REGEX,
  getTodayInAustralia,
  isFutureAustraliaDate,
  isTodayOrFutureAustraliaDate,
  isValidDateOnly,
  normalizeApplicationEmail,
} from '../shared/applicationSubmission.js';

export const modelYearSchema = z.number().int().min(1900).max(new Date().getFullYear() + 1);
export const weeklyPriceSchema = z.number().positive();

const dateOnlySchema = (requiredMessage: string, invalidMessage: string) =>
  z.string().trim().min(1, requiredMessage).refine(isValidDateOnly, invalidMessage);

export const carSchema = z.object({
  name: z.string().min(1),
  model_year: modelYearSchema,
  weekly_price: weeklyPriceSchema,
  bond: z.number().nonnegative(),
  status: z.enum(['Available', 'Rented', 'Maintenance']),
  image: z.string().url(),
});

export const applicationSchema = z.object({
  name: z.string().trim().min(2),
  phone: z
    .string()
    .trim()
    .regex(AUSTRALIAN_MOBILE_REGEX, 'Valid Australian mobile number required'),
  email: z.string().transform(normalizeApplicationEmail).pipe(z.string().email()),
  license_number: z.string().trim().min(5),
  license_expiry: dateOnlySchema(
    'License expiry date is required',
    'License expiry date must be a valid date'
  ).refine((value) => isFutureAustraliaDate(value, getTodayInAustralia()), 'License must not be expired'),
  uber_status: z.enum(['Active', 'Applying', 'Not Yet Registered']),
  experience: z.string().trim().min(1),
  address: z.string().trim().min(5),
  weekly_budget: z.string().trim().optional(),
  intended_start_date: dateOnlySchema(
    'Start date is required',
    'Start date must be a valid date'
  ).refine(
    (value) => isTodayOrFutureAustraliaDate(value, getTodayInAustralia()),
    'Start date must be today or later'
  ),
  license_photo: z.string().min(1),
  license_back_photo: z.string().min(1),
});

export const applicationStatusEnum = z.enum(['Pending', 'Paid', 'Approved', 'Rejected']);

export const vehicleCheckoutSessionSchema = z.object({
  application_id: z.coerce.number().int().positive(),
  car_id: z.coerce.number().int().positive(),
  checkout_token: z.string().min(1),
});

export const applicationApprovalSchema = z.object({
  approved_bond: z.coerce.number().nonnegative(),
  approved_weekly_price: z.coerce.number().positive(),
  application_id: z.coerce.number().int().positive(),
  assigned_car_id: z.coerce.number().int().positive(),
  send_payment_link: z.boolean().optional().default(true),
});

export const vehicleCheckoutLinkSchema = z.object({
  application_id: z.coerce.number().int().positive(),
});

export const leaseFeeSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  amount: z.string().min(1),
});

export const leaseAgreementSchema = z.object({
  agreementDate: z.string().optional(),
  registeredOwnerName: z.string().optional(),
  registeredOwnerAddress: z.string().optional(),
  registeredOwnerContact: z.string().optional(),
  registeredOwnerEmail: z.string().optional(),
  renteeName: z.string().optional(),
  renteeDob: z.string().optional(),
  renteeLicenseNumber: z.string().optional(),
  renteeLicenseState: z.string().optional(),
  renteeAddress: z.string().optional(),
  renteeContact: z.string().optional(),
  renteeEmail: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleYear: z.string().optional(),
  vehicleVin: z.string().optional(),
  kmAllowance: z.string().optional(),
  weeklyRent: z.string().optional(),
  fuelPolicy: z.string().optional(),
  insuranceCoverage: z.string().optional(),
  rentalStartDate: z.string().optional(),
  rentalEndDate: z.string().optional(),
  minimumRentalPeriod: z.string().optional(),
  returnPolicy: z.string().optional(),
  fees: z.array(leaseFeeSchema).optional(),
});

export const createLeaseAgreementSchema = z.object({
  application_id: z.coerce.number().int().positive(),
  car_id: z.coerce.number().int().positive(),
  content: z.string().min(1),
  status: z.string().optional().default('generated'),
});
