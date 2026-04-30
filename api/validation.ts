import { z } from "zod";

import {
  AUSTRALIAN_MOBILE_REGEX,
  getTodayInAustralia,
  isFutureAustraliaDate,
  isTodayOrFutureAustraliaDate,
  isValidDateOnly,
  normalizeApplicationEmail,
  normalizeAustralianMobile,
} from "../shared/applicationSubmission.js";

export const modelYearSchema = z
  .number()
  .int()
  .min(1900)
  .max(new Date().getFullYear() + 1);
export const weeklyPriceSchema = z.number().positive();
const isRootRelativeAssetPath = (value: string) =>
  value.startsWith("/") && !value.startsWith("//");
const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};
const carImageSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => isRootRelativeAssetPath(value) || isHttpUrl(value),
    "Image must be a root-relative asset path or an absolute HTTP(S) URL",
  );

export const adminLoginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const dateOnlySchema = (requiredMessage: string, invalidMessage: string) =>
  z
    .string()
    .trim()
    .min(1, requiredMessage)
    .refine(isValidDateOnly, invalidMessage);
const optionalPositiveIntegerSchema = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.number().int().positive().optional(),
);
const requiredPositiveIntegerSchema = z.coerce.number().int().positive();

export const uuidSchema = z.string().trim().uuid("Expected a UUID identifier");

export const carSchema = z.object({
  name: z.string().min(1),
  model_year: modelYearSchema,
  weekly_price: weeklyPriceSchema,
  bond: z.number().nonnegative(),
  status: z.enum(["Available", "Rented", "Maintenance"]),
  image: carImageSchema,
});

export const applicationSchema = z.object({
  name: z.string().trim().min(2),
  phone: z
    .string()
    .transform(normalizeAustralianMobile)
    .pipe(
      z
        .string()
        .regex(
          AUSTRALIAN_MOBILE_REGEX,
          "Valid Australian mobile number required",
        ),
    ),
  email: z
    .string()
    .transform(normalizeApplicationEmail)
    .pipe(z.string().email()),
  license_number: z.string().trim().min(5),
  license_expiry: dateOnlySchema(
    "License expiry date is required",
    "License expiry date must be a valid date",
  ).refine(
    (value) => isFutureAustraliaDate(value, getTodayInAustralia()),
    "License must not be expired",
  ),
  uber_status: z.enum(["Active", "Applying", "Not Yet Registered"]),
  experience: z.string().trim().min(1),
  address: z.string().trim().min(5),
  weekly_budget: z.string().trim().optional(),
  agreement_accepted: z.enum(['true']),
  agreement_signature: z.string().trim().min(2),
  intended_start_date: dateOnlySchema(
    "Start date is required",
    "Start date must be a valid date",
  ).refine(
    (value) => isTodayOrFutureAustraliaDate(value, getTodayInAustralia()),
    "Start date must be today or later",
  ),
});

export const applicationStatusEnum = z.enum([
  "Pending",
  "Paid",
  "Approved",
  "Rejected",
  "Payment Review",
  "Cancelled",
]);

export const vehicleCheckoutSessionSchema = z.object({
  application_id: uuidSchema,
  checkout_token: z.string().min(1),
});

export const applicationApprovalSchema = z.object({
  approved_vehicle: z.string().trim().min(1),
  approved_bond: z.coerce.number().nonnegative(),
  approved_weekly_price: z.coerce.number().positive(),
  application_id: uuidSchema,
  car_id: optionalPositiveIntegerSchema,
  send_payment_link: z.boolean().optional().default(true),
});

export const vehicleCheckoutLinkSchema = z.object({
  application_id: uuidSchema,
  car_id: optionalPositiveIntegerSchema,
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
  application_id: uuidSchema,
  car_id: optionalPositiveIntegerSchema,
  content: z.string().min(1),
  status: z.string().optional().default("generated"),
  vehicle_label: z.string().trim().optional(),
});
