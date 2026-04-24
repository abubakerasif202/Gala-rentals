-- Remove the legacy approval-time vehicle allocation contract.
-- Admin approval now stores a plain approved_vehicle text value, and any
-- operational vehicle selection happens later through agreements/rentals.

DROP INDEX IF EXISTS idx_applications_active_vehicle_allocation_unique;
DROP INDEX IF EXISTS idx_applications_assigned_car_id;

ALTER TABLE public.applications
  DROP COLUMN IF EXISTS assigned_car_id;

ALTER TABLE public.applications
  DROP COLUMN IF EXISTS "assignedCarId";
