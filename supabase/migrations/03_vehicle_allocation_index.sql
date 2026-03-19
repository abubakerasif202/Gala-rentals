-- Resolve any existing duplicate approved/payment-review allocations
-- before applying this index in an existing environment.
DROP INDEX IF EXISTS idx_applications_active_vehicle_allocation_unique;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'applications'
      AND column_name = 'assigned_car_id'
  ) THEN
    EXECUTE '
      CREATE UNIQUE INDEX idx_applications_active_vehicle_allocation_unique
        ON applications(assigned_car_id)
        WHERE assigned_car_id IS NOT NULL
          AND lower(status) IN (''approved'', ''payment review'')';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'applications'
      AND column_name = 'assignedCarId'
  ) THEN
    EXECUTE '
      CREATE UNIQUE INDEX idx_applications_active_vehicle_allocation_unique
        ON applications("assignedCarId")
        WHERE "assignedCarId" IS NOT NULL
          AND lower(status) IN (''approved'', ''payment review'')';
  ELSE
    RAISE EXCEPTION 'Could not find assigned vehicle column on public.applications';
  END IF;
END $$;
