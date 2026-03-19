-- Enforce strict status enums for core tables to ensure data integrity
-- across manual DB edits and application code.

-- 1. Cars Status
ALTER TABLE public.cars
  DROP CONSTRAINT IF EXISTS cars_status_check;
ALTER TABLE public.cars
  ADD CONSTRAINT cars_status_check
  CHECK (status IN ('Available', 'Rented', 'Maintenance'));

-- 2. Applications Status
ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN ('Pending', 'Approved', 'Payment Review', 'Paid', 'Rejected'));

-- 3. Rentals Status
ALTER TABLE public.rentals
  DROP CONSTRAINT IF EXISTS rentals_status_check;
ALTER TABLE public.rentals
  ADD CONSTRAINT rentals_status_check
  CHECK (status IN ('Active', 'Completed', 'Cancelled', 'Overdue'));
