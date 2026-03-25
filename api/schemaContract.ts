import { getSchemaCompat } from './schemaCompat.js';

const PRODUCTION_SCHEMA_CONTRACT_REQUIRED_COLUMNS = {
  applications: [
    'approved_at',
    'approved_bond',
    'approved_weekly_price',
    'assigned_car_id',
    'paid_at',
    'payment_link_sent_at',
    'payment_link_version',
    'pending_checkout_session_id',
  ],
  cars: ['created_at'],
  rentals: ['stripe_customer_id', 'stripe_subscription_id'],
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
  requiredColumns: readonly string[]
) => requiredColumns.filter((column) => !availableColumns.has(column));

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
        compat.applicationApprovedAtColumn,
        compat.applicationAssignedCarColumn,
        compat.applicationApprovedBondColumn,
        compat.applicationApprovedWeeklyPriceColumn,
        compat.applicationPaidAtColumn,
        compat.applicationPaymentLinkSentAtColumn,
        compat.applicationPaymentLinkVersionColumn,
        compat.applicationPendingCheckoutSessionColumn,
        compat.carCreatedAtColumn,
        compat.rentalStripeCustomerColumn,
        compat.rentalStripeSubscriptionColumn,
      ].filter((value): value is string => Boolean(value));

      const missingCompatColumns = compatMappedColumns.filter((column) => {
        if (column.startsWith('stripe_')) {
          return !(columnsByTable.get('rentals') || new Set<string>()).has(column);
        }

        if (column === 'created_at') {
          return !(columnsByTable.get('cars') || new Set<string>()).has(column);
        }

        return !(columnsByTable.get('applications') || new Set<string>()).has(column);
      });

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
