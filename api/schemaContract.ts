import { getSchemaCompat } from './schemaCompat.js';

type RequiredColumnContract = {
  acceptable: readonly string[];
  label: string;
};

const PRODUCTION_SCHEMA_CONTRACT_REQUIRED_COLUMNS = {
  applications: [
    { label: 'approved_at', acceptable: ['approved_at', 'approvedAt'] },
    { label: 'approved_bond', acceptable: ['approved_bond', 'approvedBond'] },
    {
      label: 'approved_weekly_price',
      acceptable: ['approved_weekly_price', 'approvedWeeklyPrice'],
    },
    { label: 'assigned_car_id', acceptable: ['assigned_car_id', 'assignedCarId'] },
    { label: 'paid_at', acceptable: ['paid_at', 'paidAt'] },
    {
      label: 'payment_link_sent_at',
      acceptable: ['payment_link_sent_at', 'paymentLinkSentAt'],
    },
    {
      label: 'payment_link_version',
      acceptable: ['payment_link_version', 'paymentLinkVersion'],
    },
    {
      label: 'pending_checkout_session_id',
      acceptable: ['pending_checkout_session_id', 'pendingCheckoutSessionId'],
    },
  ],
  cars: [{ label: 'created_at', acceptable: ['created_at', 'createdAt'] }],
  rentals: [
    {
      label: 'stripe_customer_id',
      acceptable: ['stripe_customer_id', 'stripeCustomerId'],
    },
    {
      label: 'stripe_subscription_id',
      acceptable: ['stripe_subscription_id', 'stripeSubscriptionId'],
    },
  ],
} as const;

let schemaContractValidationPromise: Promise<void> | null = null;

const readEnv = (key: string) => {
  const value = process.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const getSchemaInspectionContext = () => {
  const supabaseUrl = readEnv('SUPABASE_URL');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for schema contract validation.'
    );
  }

  return {
    serviceRoleKey,
    supabaseUrl,
  };
};

const fetchOpenApiDefinitions = async () => {
  const { serviceRoleKey, supabaseUrl } = getSchemaInspectionContext();
  const response = await fetch(new URL('/rest/v1/', supabaseUrl), {
    headers: {
      Accept: 'application/openapi+json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to verify production schema contract: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as {
    definitions?: Record<string, { properties?: Record<string, unknown> }>;
  };
};

const findMissingColumns = (
  availableColumns: Set<string>,
  requiredColumns: readonly RequiredColumnContract[]
) =>
  requiredColumns
    .filter((column) => !column.acceptable.some((candidate) => availableColumns.has(candidate)))
    .map((column) => column.label);

export const verifyProductionSchemaContract = async () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  if (!schemaContractValidationPromise) {
    schemaContractValidationPromise = (async () => {
      const compat = await getSchemaCompat();
      const spec = await fetchOpenApiDefinitions();

      const columnsByTable = new Map<string, Set<string>>();
      Object.entries(spec.definitions || {}).forEach(([tableName, definition]) => {
        const properties = definition?.properties || {};
        columnsByTable.set(tableName, new Set(Object.keys(properties)));
      });

      const missingContracts = Object.entries(PRODUCTION_SCHEMA_CONTRACT_REQUIRED_COLUMNS)
        .map(([tableName, requiredColumns]) => {
          const availableColumns = columnsByTable.get(tableName) || new Set<string>();
          const missing = findMissingColumns(availableColumns, requiredColumns);
          return missing.length > 0 ? `${tableName}: ${missing.join(', ')}` : null;
        })
        .filter((entry): entry is string => Boolean(entry));

      const compatMappedColumns = [
        { table: 'applications', column: compat.applicationApprovedAtColumn },
        { table: 'applications', column: compat.applicationAssignedCarColumn },
        { table: 'applications', column: compat.applicationApprovedBondColumn },
        { table: 'applications', column: compat.applicationApprovedWeeklyPriceColumn },
        { table: 'applications', column: compat.applicationPaidAtColumn },
        { table: 'applications', column: compat.applicationPaymentLinkSentAtColumn },
        { table: 'applications', column: compat.applicationPaymentLinkVersionColumn },
        { table: 'applications', column: compat.applicationPendingCheckoutSessionColumn },
        { table: 'cars', column: compat.carCreatedAtColumn },
        { table: 'rentals', column: compat.rentalStripeCustomerColumn },
        { table: 'rentals', column: compat.rentalStripeSubscriptionColumn },
      ].filter(
        (value): value is { table: string; column: string } => Boolean(value.column)
      );

      const missingCompatColumns = compatMappedColumns
        .filter(
          ({ column, table }) => !(columnsByTable.get(table) || new Set<string>()).has(column)
        )
        .map(({ column }) => column);

      if (missingContracts.length > 0 || missingCompatColumns.length > 0) {
        const details = [
          ...missingContracts,
          ...(missingCompatColumns.length > 0
            ? [`schema compat mapped columns missing: ${missingCompatColumns.join(', ')}`]
            : []),
        ].join('; ');

        throw new Error(
          `Production schema contract check failed. Missing required columns: ${details}. ` +
            'Apply pending migrations before deploying this version.'
        );
      }
    })().catch((error) => {
      schemaContractValidationPromise = null;
      throw error;
    });
  }

  return schemaContractValidationPromise;
};

export const resetSchemaContractValidationForTests = () => {
  schemaContractValidationPromise = null;
};
