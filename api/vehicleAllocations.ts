import { db } from './db/index.js';
import { getApplicationSelectColumns, getSchemaCompat } from './schemaCompat.js';

export const VEHICLE_ALLOCATION_BLOCKING_STATUSES = [
  'Approved',
  'Payment Review',
] as const;

export class VehicleAllocationConflictError extends Error {
  status = 409;

  constructor(message: string) {
    super(message);
    this.name = 'VehicleAllocationConflictError';
  }
}

export const findConflictingVehicleApplication = async ({
  carId,
  excludeApplicationId,
}: {
  carId: number;
  excludeApplicationId: number;
}) => {
  const compat = await getSchemaCompat();
  const selectColumns = await getApplicationSelectColumns();
  const { data, error } = await db
    .from('applications')
    .select(selectColumns)
    .eq(compat.applicationAssignedCarColumn, carId)
    .in('status', [...VEHICLE_ALLOCATION_BLOCKING_STATUSES])
    .order('id', { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data || []) as unknown as Array<Record<string, unknown>>;
  return rows.find((row) => Number(row.id) !== excludeApplicationId) || null;
};

export const assertVehicleAllocationAvailable = async ({
  applicationId,
  carId,
  message,
}: {
  applicationId: number;
  carId: number;
  message: string;
}) => {
  const conflict = await findConflictingVehicleApplication({
    carId,
    excludeApplicationId: applicationId,
  });

  if (conflict) {
    throw new VehicleAllocationConflictError(message);
  }
};
