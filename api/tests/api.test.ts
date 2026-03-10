import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const {
  mockState,
  mockGetUser,
  mockSignInWithPassword,
  mockStorageFrom,
  mockCheckDBHealth,
  mockCreateAuthClient,
  mockStripe,
} = vi.hoisted(() => ({
  mockState: {
    cars: [] as Array<Record<string, any>>,
    applications: [] as Array<Record<string, any>>,
    rentals: [] as Array<Record<string, any>>,
    customers: [] as Array<Record<string, any>>,
    invoices: [] as Array<Record<string, any>>,
    bookings: [] as Array<Record<string, any>>,
  },
  mockGetUser: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockCheckDBHealth: vi.fn(),
  mockCreateAuthClient: vi.fn(),
  mockStripe: {
    checkoutSessionsCreate: vi.fn(),
    checkoutSessionsExpire: vi.fn(),
    checkoutSessionsRetrieve: vi.fn(),
    subscriptionsRetrieve: vi.fn(),
    webhooksConstructEvent: vi.fn(),
  },
}));

vi.mock('stripe', () => {
  class MockStripe {
    customers = { create: vi.fn() };
    products = { create: vi.fn() };
    prices = { create: vi.fn() };
    invoiceItems = { create: vi.fn() };
    subscriptions = { create: vi.fn(), retrieve: mockStripe.subscriptionsRetrieve };
    checkout = {
      sessions: {
        create: mockStripe.checkoutSessionsCreate,
        expire: mockStripe.checkoutSessionsExpire,
        retrieve: mockStripe.checkoutSessionsRetrieve,
      },
    };
    webhooks = {
      constructEvent: mockStripe.webhooksConstructEvent,
    };
    accounts = {
      create: vi.fn(),
      retrieve: vi.fn(),
    };
    accountLinks = {
      create: vi.fn(),
    };
    payouts = {
      list: vi.fn(),
    };
    balanceTransactions = {
      list: vi.fn(),
    };
  }

  return {
    default: MockStripe,
  };
});

vi.mock('../schemaCompat.js', async () => {
  const actual = await vi.importActual<typeof import('../schemaCompat.js')>(
    '../schemaCompat.js'
  );

  return {
    ...actual,
    getApplicationSelectColumns: vi.fn(async () =>
      [
        'id',
        'name',
        'phone',
        'email',
        'license_number:licenseNumber',
        'license_expiry:licenseExpiry',
        'uber_status:uberStatus',
        'experience',
        'address',
        'weekly_budget:weeklyBudget',
        'intended_start_date:intendedStartDate',
        'license_photo:licensePhoto',
        'license_back_photo:uberScreenshot',
        'assigned_car_id:assignedCarId',
        'approved_bond:approvedBond',
        'approved_weekly_price:approvedWeeklyPrice',
        'payment_link_version:paymentLinkVersion',
        'payment_link_sent_at:paymentLinkSentAt',
        'approved_at:approvedAt',
        'paid_at:paidAt',
        'pending_checkout_session_id:pendingCheckoutSessionId',
        'status',
        'created_at:createdAt',
      ].join(', ')
    ),
  };
});

vi.mock('../db/index.js', () => {
  const getTableRows = (table: string) => {
    if (table === 'cars') {
      return mockState.cars;
    }

    if (table === 'applications') {
      return mockState.applications;
    }

    if (table === 'rentals') {
      return mockState.rentals;
    }

    if (table === 'customers') {
      return mockState.customers;
    }

    if (table === 'invoices') {
      return mockState.invoices;
    }

    if (table === 'bookings') {
      return mockState.bookings;
    }

    return [];
  };

  type QueryFilter =
    | { type: 'eq'; column: string; value: unknown }
    | { type: 'ilike'; column: string; pattern: string }
    | { type: 'in'; column: string; values: unknown[] }
    | { type: 'or'; clauses: Array<{ column: string; search: string }> };

  const applyFilters = (
    rows: Array<Record<string, any>>,
    filters: QueryFilter[]
  ) =>
    rows.filter((row) =>
      filters.every((filter) => {
        if (filter.type === 'eq') {
          return String(row[filter.column]) === String(filter.value);
        }

        if (filter.type === 'ilike') {
          const source = String(row[filter.column] ?? '');
          const escapedPattern = filter.pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/[%*]/g, '.*')
            .replace(/_/g, '.');

          return new RegExp(`^${escapedPattern}$`, 'i').test(source);
        }

        if (filter.type === 'in') {
          return filter.values.some((value) => String(row[filter.column]) === String(value));
        }

        return filter.clauses.some(({ column, search }) =>
          String(row[column] || '').toLowerCase().includes(search.toLowerCase())
        );
      })
    );

  const applyOrder = (
    rows: Array<Record<string, any>>,
    order?: { column: string; ascending: boolean } | null
  ) => {
    if (!order) {
      return rows;
    }

    return [...rows].sort((left, right) => {
      const leftValue = left[order.column];
      const rightValue = right[order.column];

      if (leftValue === rightValue) {
        return 0;
      }

      if (leftValue == null) {
        return order.ascending ? -1 : 1;
      }

      if (rightValue == null) {
        return order.ascending ? 1 : -1;
      }

      if (leftValue > rightValue) {
        return order.ascending ? 1 : -1;
      }

      return order.ascending ? -1 : 1;
    });
  };

  const applyRange = (
    rows: Array<Record<string, any>>,
    range?: { from: number; to: number } | null
  ) => {
    if (!range) {
      return rows;
    }

    return rows.slice(range.from, range.to + 1);
  };

  const parseOrClauses = (expression: string) =>
    expression
      .split(',')
      .map((clause) => {
        const [column, operator, ...rest] = clause.split('.');

        if (!column || operator !== 'ilike') {
          return null;
        }

        const search = rest.join('.').replace(/^%+|%+$/g, '').replace(/^\*+|\*+$/g, '');
        return search ? { column, search } : null;
      })
      .filter((clause): clause is { column: string; search: string } => Boolean(clause));

  const createUnknownColumnError = (column: string) => {
    const camelColumnMap: Record<string, string> = {
      license_number: 'licenseNumber',
      license_expiry: 'licenseExpiry',
      license_photo: 'licensePhoto',
      license_back_photo: 'licenseBackPhoto',
    };

    return {
    code: '42703',
    details: null,
    hint: `Perhaps you meant to reference the column "applications.${camelColumnMap[column] ?? column}".`,
    message: `column applications.${column} does not exist`,
    };
  };

  const getInvalidApplicationSelectColumn = (columns?: string) => {
    if (typeof columns !== 'string') {
      return null;
    }

    const invalidColumns = ['license_number', 'license_expiry', 'license_photo', 'license_back_photo'];
    return (
      invalidColumns.find(
        (column) => columns.includes(column) && !columns.includes(`${column}:`)
      ) || null
    );
  };

  const createSelectQuery = (
    table: string,
    columns?: string,
    options: { count?: string; head?: boolean } = {},
    filters: QueryFilter[] = [],
    order?: { column: string; ascending: boolean } | null,
    range?: { from: number; to: number } | null
  ) => {
    const invalidApplicationColumn =
      table === 'applications' ? getInvalidApplicationSelectColumn(columns) : null;

    const resolveRows = async () => {
      if (invalidApplicationColumn) {
        return {
          data: null,
          error: createUnknownColumnError(invalidApplicationColumn),
          count: null,
        };
      }

      const filteredRows = applyFilters(getTableRows(table), filters);
      const orderedRows = applyOrder(filteredRows, order);
      const selectedRows = applyRange(orderedRows, range);

      return {
        data: options.head ? null : structuredClone(selectedRows),
        error: null,
        count: options.count === 'exact' ? filteredRows.length : null,
      };
    };

    return {
      then: (
        onFulfilled: (value: {
          data: Array<Record<string, any>> | null;
          error: null | Record<string, any>;
          count: number | null;
        }) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => resolveRows().then(onFulfilled, onRejected),
      order: vi.fn((column: string, { ascending = true }: { ascending?: boolean } = {}) =>
        createSelectQuery(table, columns, options, filters, { column, ascending }, range)
      ),
      eq: vi.fn((column: string, value: unknown) =>
        createSelectQuery(table, columns, options, [...filters, { type: 'eq', column, value }], order, range)
      ),
      ilike: vi.fn((column: string, pattern: string) =>
        createSelectQuery(
          table,
          columns,
          options,
          [...filters, { type: 'ilike', column, pattern }],
          order,
          range
        )
      ),
      in: vi.fn((column: string, values: unknown[]) =>
        createSelectQuery(table, columns, options, [...filters, { type: 'in', column, values }], order, range)
      ),
      or: vi.fn((expression: string) => {
        const clauses = parseOrClauses(expression);
        return createSelectQuery(
          table,
          columns,
          options,
          clauses.length > 0 ? [...filters, { type: 'or', clauses }] : filters,
          order,
          range
        );
      }),
      range: vi.fn((from: number, to: number) =>
        createSelectQuery(table, columns, options, filters, order, { from, to })
      ),
      limit: vi.fn((count: number) =>
        createSelectQuery(table, columns, options, filters, order, {
          from: range?.from ?? 0,
          to: (range?.from ?? 0) + count - 1,
        })
      ),
      single: vi.fn(async () => {
        if (invalidApplicationColumn) {
          return { data: null, error: createUnknownColumnError(invalidApplicationColumn) };
        }

        const filteredRows = applyFilters(getTableRows(table), filters);
        const orderedRows = applyOrder(filteredRows, order);
        const [row] = applyRange(orderedRows, range);
        return row
          ? { data: structuredClone(row), error: null }
          : {
              data: null,
              error: {
                code: 'PGRST116',
                details: 'The result contains 0 rows',
                message: 'Not found',
              },
            };
      }),
      maybeSingle: vi.fn(async () => {
        if (invalidApplicationColumn) {
          return { data: null, error: createUnknownColumnError(invalidApplicationColumn) };
        }

        const filteredRows = applyFilters(getTableRows(table), filters);
        const orderedRows = applyOrder(filteredRows, order);
        const [row] = applyRange(orderedRows, range);
        return {
          data: row ? structuredClone(row) : null,
          error: null,
        };
      }),
    };
  };

  const createMutationQuery = (
    table: string,
    action: 'update' | 'delete',
    payload?: Record<string, any>
  ) => ({
    eq: vi.fn(async (column: string, value: unknown) => {
      const rows = getTableRows(table);
      const nextRows =
        action === 'delete'
          ? rows.filter((row) => String(row[column]) !== String(value))
          : rows.map((row) =>
              String(row[column]) === String(value) ? { ...row, ...payload } : row
            );

      if (table === 'cars') {
        mockState.cars = nextRows;
      }

      if (table === 'applications') {
        mockState.applications = nextRows;
      }

      if (table === 'rentals') {
        mockState.rentals = nextRows;
      }

      if (table === 'customers') {
        mockState.customers = nextRows;
      }

      if (table === 'invoices') {
        mockState.invoices = nextRows;
      }

      if (table === 'bookings') {
        mockState.bookings = nextRows;
      }

      return { error: null };
    }),
  });

  const createInsertQuery = (table: string, records: Array<Record<string, any>>) => {
    const currentRows = getTableRows(table);
    const nextId =
      currentRows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
    const insertedRow = { ...records[0], id: nextId };

    if (table === 'cars') {
      mockState.cars = [...mockState.cars, insertedRow];
    }

    if (table === 'applications') {
      mockState.applications = [...mockState.applications, insertedRow];
    }

    if (table === 'rentals') {
      mockState.rentals = [...mockState.rentals, insertedRow];
    }

    if (table === 'customers') {
      mockState.customers = [...mockState.customers, insertedRow];
    }

    if (table === 'invoices') {
      mockState.invoices = [...mockState.invoices, insertedRow];
    }

    if (table === 'bookings') {
      mockState.bookings = [...mockState.bookings, insertedRow];
    }

    return {
      error: null,
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: insertedRow.id }, error: null })),
      })),
    };
  };

  return {
    db: {
      from: vi.fn((table: string) => ({
        select: vi.fn((columns?: string, options?: { count?: string; head?: boolean }) =>
          createSelectQuery(table, columns, options)
        ),
        insert: vi.fn((records: Array<Record<string, any>>) =>
          createInsertQuery(table, records)
        ),
        update: vi.fn((payload: Record<string, any>) =>
          createMutationQuery(table, 'update', payload)
        ),
        delete: vi.fn(() => createMutationQuery(table, 'delete')),
      })),
      storage: {
        from: mockStorageFrom,
        listBuckets: vi.fn(async () => ({ data: [], error: null })),
        createBucket: vi.fn(async () => ({ error: null })),
        updateBucket: vi.fn(async () => ({ error: null })),
      },
    },
    createAuthClient: mockCreateAuthClient,
    checkDBHealth: mockCheckDBHealth,
    initializeDB: vi.fn(() => Promise.resolve()),
  };
});

process.env.CHECKOUT_LINK_SECRET = 'test-checkout-secret';

import app from '../index.js';
import { createCheckoutToken, verifyCheckoutToken } from '../checkoutTokens.js';

beforeEach(() => {
  mockState.cars = [
    {
      id: 1,
      name: 'Toyota Camry',
      model_year: 2024,
      weekly_price: 250,
      bond: 500,
      status: 'Available',
      image: 'https://example.com/camry.jpg',
      created_at: '2026-03-01T00:00:00.000Z',
    },
    {
      id: 2,
      name: 'Toyota Prius',
      model_year: 2023,
      weekly_price: 275,
      bond: 600,
      status: 'Rented',
      image: 'https://example.com/prius.jpg',
      created_at: '2026-03-02T00:00:00.000Z',
    },
  ];

  mockState.applications = [
    {
      id: 1,
      approved_at: null,
      approved_bond: null,
      approved_weekly_price: null,
      assigned_car_id: null,
      name: 'Jane Driver',
      phone: '0412345678',
      email: 'jane@example.com',
      license_number: 'NSW12345',
      license_expiry: '2027-01-01',
      uber_status: 'Active',
      experience: 'New Driver',
      address: '1 Test Street',
      weekly_budget: '$300/week',
      intended_start_date: '2026-03-10',
      license_photo: 'docs/license-1.png',
      license_back_photo: 'docs/license-back-1.png',
      paid_at: null,
      payment_link_sent_at: null,
      payment_link_version: 0,
      pending_checkout_session_id: null,
      status: 'Pending',
      created_at: '2026-03-03T00:00:00.000Z',
    },
    {
      id: 2,
      approved_at: '2026-03-05T00:00:00.000Z',
      approved_bond: 500,
      approved_weekly_price: 250,
      assigned_car_id: 1,
      name: 'Approved Driver',
      phone: '0499999999',
      email: 'approved@example.com',
      license_number: 'NSW99999',
      license_expiry: '2027-06-01',
      uber_status: 'Active',
      experience: '1-3 years',
      address: '2 Test Street',
      weekly_budget: '$350/week',
      intended_start_date: '2026-03-12',
      license_photo: 'https://project.supabase.co/storage/v1/object/public/applications/docs/license-2.png',
      license_back_photo: null,
      paid_at: null,
      payment_link_sent_at: '2026-03-05T00:00:00.000Z',
      payment_link_version: 1,
      pending_checkout_session_id: null,
      status: 'Approved',
      created_at: '2026-03-04T00:00:00.000Z',
    },
  ];

  mockState.rentals = [];

  mockState.customers = [
    {
      id: 1,
      external_id: '60499',
      staff_number: '1012',
      full_name: 'Gagandeep Singh',
      preferred_name: 'Gagandeep Singh',
      company_name: 'Gagandeep',
      phone: '0423115111',
      email: 'gagandeep.561222@gmail.com',
      date_of_birth: '1999-09-24',
      street: null,
      city: null,
      postcode: null,
      state: null,
      source: 'legacy-import',
      created_at: '2026-03-05T00:00:00.000Z',
      updated_at: '2026-03-05T00:00:00.000Z',
    },
    {
      id: 2,
      external_id: '61617',
      staff_number: '1013',
      full_name: 'Hasan Nasir',
      preferred_name: 'Hasan Nasir',
      company_name: 'Hasan',
      phone: '0411127067',
      email: 'hasanchahal0@gmail.com',
      date_of_birth: '2001-05-15',
      street: null,
      city: null,
      postcode: null,
      state: null,
      source: 'legacy-import',
      created_at: '2026-03-05T00:00:00.000Z',
      updated_at: '2026-03-05T00:00:00.000Z',
    },
  ];

  mockState.invoices = [
    {
      id: 1,
      external_invoice_number: '1882',
      customer_id: 1,
      customer_name: 'Gagandeep Singh',
      car_registration: 'CNO40S',
      invoice_date: '2026-03-05',
      due_label: 'Wed 11 Mar',
      amount: 230.99,
      balance: 230.99,
      transaction_summary: '',
      source: 'legacy-import',
      created_at: '2026-03-05T00:00:00.000Z',
    },
    {
      id: 2,
      external_invoice_number: '1881',
      customer_id: 2,
      customer_name: 'Hasan Nasir',
      car_registration: 'YNU55M',
      invoice_date: '2026-03-04',
      due_label: 'Wed 04 Mar',
      amount: 386.09,
      balance: 0,
      transaction_summary: '$386.09 - 04 Mar 2026 - Direct Debit',
      source: 'legacy-import',
      created_at: '2026-03-04T00:00:00.000Z',
    },
  ];

  mockState.bookings = [
    {
      id: 10,
      total_amount: 230.99,
    },
    {
      id: 11,
      total_amount: 0,
    },
  ];

  mockGetUser.mockResolvedValue({
    data: { user: { email: 'admin@maplerentals.com.au' } },
    error: null,
  });
  mockSignInWithPassword.mockImplementation(async ({ email }: { email: string }) => ({
    data: {
      session: { access_token: 'fake-token' },
      user: { email },
    },
    error: null,
  }));
  mockCreateAuthClient.mockReturnValue({
    auth: {
      getUser: mockGetUser,
      signInWithPassword: mockSignInWithPassword,
    },
  });
  mockCheckDBHealth.mockResolvedValue({ configured: true });
  mockStorageFrom.mockImplementation((bucket: string) => ({
    upload: vi.fn(async (path: string) => ({ data: { path }, error: null })),
    createSignedUrl: vi.fn(async (path: string) => ({
      data: { signedUrl: `https://signed.example/${bucket}/${path}` },
      error: null,
    })),
    remove: vi.fn(async () => ({ data: null, error: null })),
  }));

  mockStripe.checkoutSessionsCreate.mockResolvedValue({
    id: 'cs_test_123',
    url: 'https://checkout.stripe.com/c/pay/cs_test_123',
  });
  mockStripe.checkoutSessionsExpire.mockResolvedValue({ id: 'cs_test_123' });
  mockStripe.checkoutSessionsRetrieve.mockResolvedValue({
    id: 'cs_test_123',
    url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    status: 'complete',
    payment_status: 'paid',
    metadata: {
      application_id: '2',
      approved_bond: '500.00',
      approved_weekly_price: '250.00',
      car_id: '1',
      checkout_kind: 'vehicle',
      payment_link_version: '1',
    },
  });
  mockStripe.subscriptionsRetrieve.mockResolvedValue({
    id: 'sub_test_123',
    metadata: { application_id: '2', car_id: '1' },
  });
  mockStripe.webhooksConstructEvent.mockReset();

  vi.clearAllMocks();
});

describe('Cars API', () => {
  it('GET /api/cars should return a list of cars', async () => {
    const res = await request(app).get('/api/cars');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].name).toBe('Toyota Prius');
  });

  it('GET /api/cars/:id should return a single car', async () => {
    const res = await request(app).get('/api/cars/1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Toyota Camry');
  });
});

describe('Auth API', () => {
  it('POST /api/auth/login should log in an admin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin@maplerentals.com.au', password: 'password' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('admin@maplerentals.com.au');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /api/auth/login should deny non-admin email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'notadmin@example.com', password: 'password' });

    expect(res.status).toBe(403);
  });
});

describe('Applications API', () => {
  it('GET /api/health reports database readiness', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      database: 'ok',
    });
  });

  it('GET /api/health returns 503 when the database health check fails', async () => {
    mockCheckDBHealth.mockRejectedValueOnce(new Error('database unavailable'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      status: 'error',
      database: 'unavailable',
    });
  });

  it('GET /api/applications returns signed document URLs for admins', async () => {
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(res.body[0].license_photo).toBe(
      'https://signed.example/applications/docs/license-2.png'
    );
    expect(res.body[1].license_photo).toBe('https://signed.example/applications/docs/license-1.png');
    expect(res.body[1].license_back_photo).toBe(
      'https://signed.example/applications/docs/license-back-1.png'
    );
  });

  it('POST /api/applications supports camel-case Supabase application schemas', async () => {
    const res = await request(app).post('/api/applications').send({
      name: 'New Driver',
      phone: '0400111222',
      email: 'newdriver@example.com',
      license_number: 'NSW55555',
      license_expiry: '2027-12-31',
      uber_status: 'Applying',
      experience: 'New Driver',
      address: '55 Test Street',
      weekly_budget: '$350/week',
      intended_start_date: '2026-03-20',
      license_photo: 'data:image/png;base64,ZmFrZQ==',
      license_back_photo: 'data:image/png;base64,ZmFrZQ==',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockState.applications).toHaveLength(3);
    expect(mockState.applications[2]).toMatchObject({
      email: 'newdriver@example.com',
      license_number: 'NSW55555',
    });
  });

  it('POST /api/applications rejects unsupported image formats', async () => {
    const res = await request(app).post('/api/applications').send({
      name: 'Unsafe Driver',
      phone: '0400111222',
      email: 'unsafe@example.com',
      license_number: 'NSW22222',
      license_expiry: '2027-12-31',
      uber_status: 'Applying',
      experience: 'New Driver',
      address: '77 Test Street',
      weekly_budget: '$320/week',
      intended_start_date: '2026-03-20',
      license_photo: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      license_back_photo: 'data:image/png;base64,ZmFrZQ==',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('JPG or PNG');
    expect(mockState.applications).toHaveLength(2);
  });

  it('POST /api/applications validates phone and date fields on the server', async () => {
    const res = await request(app).post('/api/applications').send({
      name: 'Direct API Driver',
      phone: '12345',
      email: 'direct-api@example.com',
      license_number: 'NSW42424',
      license_expiry: '2020-01-01',
      uber_status: 'Applying',
      experience: 'New Driver',
      address: '88 Test Street',
      weekly_budget: '$320/week',
      intended_start_date: '2020-01-02',
      license_photo: 'data:image/png;base64,ZmFrZQ==',
      license_back_photo: 'data:image/png;base64,ZmFrZQ==',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: 'Valid Australian mobile number required' }),
        expect.objectContaining({ message: 'License must not be expired' }),
        expect.objectContaining({ message: 'Start date must be today or later' }),
      ])
    );
    expect(mockState.applications).toHaveLength(2);
  });

  it('POST /api/applications blocks public overwrites for rejected applications', async () => {
    mockState.applications[0] = {
      ...mockState.applications[0],
      assigned_car_id: 2,
      approved_at: '2026-03-06T00:00:00.000Z',
      approved_bond: 700,
      approved_weekly_price: 320,
      paid_at: '2026-03-07T00:00:00.000Z',
      payment_link_sent_at: '2026-03-06T00:00:00.000Z',
      payment_link_version: 4,
      pending_checkout_session_id: 'cs_old_pending',
      status: 'Rejected',
    };

    const res = await request(app).post('/api/applications').send({
      name: 'Jane Driver',
      phone: '0412345678',
      email: 'jane@example.com',
      license_number: 'NSW12345',
      license_expiry: '2027-01-01',
      uber_status: 'Active',
      experience: '3+ years',
      address: '99 Updated Street',
      weekly_budget: '$410/week',
      intended_start_date: '2026-03-22',
      license_photo: 'data:image/png;base64,ZmFrZQ==',
      license_back_photo: 'data:image/png;base64,ZmFrZQ==',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already been reviewed');
    expect(mockState.applications).toHaveLength(2);
    expect(mockState.applications[0]).toMatchObject({
      id: 1,
      status: 'Rejected',
      assigned_car_id: 2,
      approved_at: '2026-03-06T00:00:00.000Z',
      approved_bond: 700,
      approved_weekly_price: 320,
      paid_at: '2026-03-07T00:00:00.000Z',
      payment_link_sent_at: '2026-03-06T00:00:00.000Z',
      payment_link_version: 4,
      pending_checkout_session_id: 'cs_old_pending',
      address: '1 Test Street',
      experience: 'New Driver',
    });
  });

  it('POST /api/applications blocks public overwrites for pending applications', async () => {
    const res = await request(app).post('/api/applications').send({
      name: 'Jane Driver',
      phone: '0412345678',
      email: 'jane@example.com',
      license_number: 'NSW12345',
      license_expiry: '2027-01-01',
      uber_status: 'Active',
      experience: '1-3 years',
      address: '12 Mixed Case Street',
      weekly_budget: '$360/week',
      intended_start_date: '2026-03-25',
      license_photo: 'data:image/png;base64,ZmFrZQ==',
      license_back_photo: 'data:image/png;base64,ZmFrZQ==',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already under review');
    expect(mockState.applications[0].address).toBe('1 Test Street');
  });

  it('POST /api/applications treats rejected email lookups case-insensitively', async () => {
    mockState.applications[0].status = 'Rejected';

    const res = await request(app).post('/api/applications').send({
      name: 'Jane Driver',
      phone: '0412345678',
      email: 'Jane@Example.com',
      license_number: 'NSW12345',
      license_expiry: '2027-01-01',
      uber_status: 'Active',
      experience: '1-3 years',
      address: '12 Mixed Case Street',
      weekly_budget: '$360/week',
      intended_start_date: '2026-03-25',
      license_photo: 'data:image/png;base64,ZmFrZQ==',
      license_back_photo: 'data:image/png;base64,ZmFrZQ==',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already been reviewed');
    expect(mockState.applications).toHaveLength(2);
    expect(mockState.applications[0]).toMatchObject({
      id: 1,
      email: 'jane@example.com',
      address: '1 Test Street',
      experience: 'New Driver',
    });
  });

  it('POST /api/applications does not treat underscores in emails as wildcard matches', async () => {
    mockState.applications = [
      {
        ...mockState.applications[0],
        id: 3,
        email: 'fooxbar@example.com',
        phone: '0400000000',
        license_number: 'NSW00000',
      },
      {
        ...mockState.applications[0],
        id: 4,
        email: 'foo_bar@example.com',
        phone: '0412345678',
        license_number: 'NSW12345',
        status: 'Rejected',
      },
    ];

    const res = await request(app).post('/api/applications').send({
      name: 'Jane Driver',
      phone: '0412345678',
      email: 'foo_bar@example.com',
      license_number: 'NSW12345',
      license_expiry: '2027-01-01',
      uber_status: 'Active',
      experience: '1-3 years',
      address: '12 Exact Match Street',
      weekly_budget: '$360/week',
      intended_start_date: '2026-03-25',
      license_photo: 'data:image/png;base64,ZmFrZQ==',
      license_back_photo: 'data:image/png;base64,ZmFrZQ==',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already been reviewed');
    expect(mockState.applications.find((application) => application.id === 3)?.address).toBe(
      '1 Test Street'
    );
    expect(mockState.applications.find((application) => application.id === 4)?.address).toBe(
      '1 Test Street'
    );
  });
});

describe('Operational history API', () => {
  it('GET /api/customers returns customer summaries for admins', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.page).toBe(1);
    expect(res.body.totalItems).toBe(2);
    expect(res.body.items[0].invoice_count).toBe(1);
    expect(res.body.items[0].total_billed).toBe(230.99);
  });

  it('GET /api/customers supports paginated search results for admins', async () => {
    const res = await request(app)
      .get('/api/customers')
      .query({ search: 'Hasan', pageSize: 1, page: 1 })
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(1);
    expect(res.body.totalPages).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].full_name).toBe('Hasan Nasir');
  });

  it('GET /api/invoices returns invoice history for admins', async () => {
    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.page).toBe(1);
    expect(res.body.totalItems).toBe(2);
    expect(res.body.items[0].external_invoice_number).toBe('1882');
    expect(res.body.items[1].status).toBe('Paid');
  });

  it('GET /api/invoices supports paginated search results for admins', async () => {
    const res = await request(app)
      .get('/api/invoices')
      .query({ search: 'YNU55M', pageSize: 1, page: 1 })
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(1);
    expect(res.body.totalPages).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].external_invoice_number).toBe('1881');
  });
});

describe('Stripe API', () => {
  it('POST /api/applications/:id/approve-payment requires admin auth', async () => {
    const res = await request(app).post('/api/applications/1/approve-payment').send({
      assigned_car_id: 1,
      approved_bond: 650,
      approved_weekly_price: 285,
    });

    expect(res.status).toBe(401);
  });

  it('POST /api/applications/:id/approve-payment stores the approved quote and returns a secure payment link', async () => {
    mockState.applications[0].pending_checkout_session_id = 'cs_old_pending';
    mockState.applications[0].payment_link_version = 3;

    const res = await request(app)
      .post('/api/applications/1/approve-payment')
      .set('Authorization', 'Bearer fake-token')
      .send({
        assigned_car_id: 1,
        approved_bond: 650,
        approved_weekly_price: 285,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.email_delivered).toBe(false);
    expect(res.body.checkout_url).toContain('/checkout/1?');
    expect(mockStripe.checkoutSessionsExpire).toHaveBeenCalledWith('cs_old_pending');

    expect(mockState.applications[0]).toMatchObject({
      assigned_car_id: 1,
      approved_bond: 650,
      approved_weekly_price: 285,
      payment_link_version: 4,
      pending_checkout_session_id: null,
      status: 'Approved',
    });

    const verified = verifyCheckoutToken({
      applicationId: 1,
      carId: 1,
      purpose: 'vehicle',
      token: res.body.checkout_token,
      version: 4,
    });
    expect(verified.version).toBe(4);
  });

  it('GET /api/stripe/payment-context returns the approved quote for a valid payment link', async () => {
    const token = createCheckoutToken({
      applicationId: 2,
      carId: 1,
      purpose: 'vehicle',
      version: 1,
    });

    const res = await request(app).get('/api/stripe/payment-context').query({
      application_id: 2,
      car_id: 1,
      checkout_token: token.token,
    });

    expect(res.status).toBe(200);
    expect(res.body.billing.bond).toBe(500);
    expect(res.body.billing.initialRental).toBe(250);
    expect(res.body.car.id).toBe(1);
  });

  it('POST /api/stripe/vehicle-checkout-session rejects unapproved applications', async () => {
    const token = createCheckoutToken({ applicationId: 1, carId: 1, purpose: 'vehicle' });

    const res = await request(app).post('/api/stripe/vehicle-checkout-session').send({
      application_id: 1,
      checkout_token: token.token,
      car_id: 1,
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('not ready for payment');
  });

  it('POST /api/stripe/vehicle-checkout-session rejects outdated payment-link versions', async () => {
    const token = createCheckoutToken({
      applicationId: 2,
      carId: 1,
      purpose: 'vehicle',
      version: 0,
    });

    const res = await request(app).post('/api/stripe/vehicle-checkout-session').send({
      application_id: 2,
      car_id: 1,
      checkout_token: token.token,
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('version mismatch');
  });

  it('POST /api/stripe/vehicle-checkout-session rejects unavailable cars', async () => {
    const token = createCheckoutToken({
      applicationId: 2,
      carId: 1,
      purpose: 'vehicle',
      version: 1,
    });
    mockState.cars[0].status = 'Rented';

    const res = await request(app).post('/api/stripe/vehicle-checkout-session').send({
      application_id: 2,
      car_id: 1,
      checkout_token: token.token,
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Selected vehicle is no longer available.');
  });

  it('POST /api/stripe/vehicle-checkout-session rejects mismatched tokens', async () => {
    const token = createCheckoutToken({
      applicationId: 2,
      carId: 2,
      purpose: 'vehicle',
      version: 1,
    });

    const res = await request(app).post('/api/stripe/vehicle-checkout-session').send({
      application_id: 2,
      car_id: 1,
      checkout_token: token.token,
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('car mismatch');
  });

  it('POST /api/stripe/vehicle-checkout-session reuses an open pending Stripe session', async () => {
    mockState.applications[1].pending_checkout_session_id = 'cs_open_approved';
    mockStripe.checkoutSessionsRetrieve.mockResolvedValueOnce({
      id: 'cs_open_approved',
      status: 'open',
      url: 'https://checkout.stripe.com/c/pay/cs_open_approved',
      payment_status: 'unpaid',
      metadata: {
        application_id: '2',
        approved_bond: '500.00',
        approved_weekly_price: '250.00',
        car_id: '1',
        checkout_kind: 'vehicle',
        payment_link_version: '1',
      },
    });
    const token = createCheckoutToken({
      applicationId: 2,
      carId: 1,
      purpose: 'vehicle',
      version: 1,
    });

    const res = await request(app).post('/api/stripe/vehicle-checkout-session').send({
      application_id: 2,
      car_id: 1,
      checkout_token: token.token,
    });

    expect(res.status).toBe(200);
    expect(res.body.session_id).toBe('cs_open_approved');
    expect(res.body.checkout_url).toBe('https://checkout.stripe.com/c/pay/cs_open_approved');
    expect(mockStripe.checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('POST /api/stripe/vehicle-checkout-session creates a hosted session from the approved quote', async () => {
    const token = createCheckoutToken({
      applicationId: 2,
      carId: 1,
      purpose: 'vehicle',
      version: 1,
    });

    const res = await request(app).post('/api/stripe/vehicle-checkout-session').send({
      application_id: 2,
      car_id: 1,
      checkout_token: token.token,
    });

    expect(res.status).toBe(200);
    expect(res.body.session_id).toBe('cs_test_123');
    expect(mockState.applications[1].pending_checkout_session_id).toBe('cs_test_123');

    const payload = mockStripe.checkoutSessionsCreate.mock.calls[0][0];
    expect(payload.metadata.checkout_kind).toBe('vehicle');
    expect(payload.metadata.application_id).toBe('2');
    expect(payload.metadata.approved_bond).toBe('500.00');
    expect(payload.metadata.approved_weekly_price).toBe('250.00');
    expect(payload.metadata.car_id).toBe('1');
    expect(payload.cancel_url).toContain('/checkout/1?');
    expect(payload.cancel_url).toContain('application_id=2');
    expect(payload.cancel_url).toContain('resume_payment=1');
    expect(payload.cancel_url).toContain(`token=${encodeURIComponent(token.token)}`);
    expect(payload.success_url).toContain('application_id=2');
    expect(payload.success_url).toContain('car_id=1');
    expect(payload.success_url).toContain(
      `checkout_token=${encodeURIComponent(token.token)}`
    );
  });

  it('POST /api/stripe/vehicle-checkout-link requires admin auth', async () => {
    const res = await request(app).post('/api/stripe/vehicle-checkout-link').send({
      application_id: 2,
    });

    expect(res.status).toBe(401);
  });

  it('POST /api/stripe/vehicle-checkout-link returns a fresh signed payment link', async () => {
    const res = await request(app)
      .post('/api/stripe/vehicle-checkout-link')
      .set('Authorization', 'Bearer fake-token')
      .send({
        application_id: 2,
      });

    expect(res.status).toBe(200);
    expect(res.body.checkout_url).toContain('/checkout/1?');
    expect(res.body.checkout_url).toContain('application_id=2');
    expect(mockState.applications[1].payment_link_version).toBe(2);
    expect(res.body.checkout_url).toContain(`token=${encodeURIComponent(res.body.checkout_token)}`);

    const verified = verifyCheckoutToken({
      applicationId: 2,
      carId: 1,
      purpose: 'vehicle',
      token: res.body.checkout_token,
      version: 2,
    });
    expect(verified.applicationId).toBe(2);
    expect(verified.carId).toBe(1);
  });

  it('GET /api/stripe/checkout-sessions/:id requires a matching checkout token', async () => {
    const res = await request(app).get('/api/stripe/checkout-sessions/cs_test_123');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('GET /api/stripe/checkout-sessions/:id returns the Stripe session status', async () => {
    const token = createCheckoutToken({
      applicationId: 2,
      carId: 1,
      purpose: 'vehicle',
      version: 1,
    });
    const res = await request(app).get('/api/stripe/checkout-sessions/cs_test_123').query({
      application_id: 2,
      car_id: 1,
      checkout_token: token.token,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      application_status: 'Approved',
      checkout_kind: 'vehicle',
      id: 'cs_test_123',
      internal_status: 'pending',
      payment_status: 'paid',
      rental_status: null,
      status: 'complete',
    });
  });

  it('GET /api/stripe/checkout-sessions/:id returns complete once rental activation exists', async () => {
    mockState.applications[1].status = 'Paid';
    mockState.rentals = [
      {
        id: 20,
        application_id: 2,
        car_id: 1,
        status: 'Active',
        weekly_price: 250,
        bond_paid: 500,
        start_date: '2026-03-01',
      },
    ];
    const token = createCheckoutToken({
      applicationId: 2,
      carId: 1,
      purpose: 'vehicle',
      version: 1,
    });
    const res = await request(app).get('/api/stripe/checkout-sessions/cs_test_123').query({
      application_id: 2,
      car_id: 1,
      checkout_token: token.token,
    });

    expect(res.status).toBe(200);
    expect(res.body.internal_status).toBe('complete');
    expect(res.body.application_status).toBe('Paid');
    expect(res.body.rental_status).toBe('Active');
  });

  it('GET /api/stripe/checkout-sessions/:id rejects sessions for the wrong checkout kind', async () => {
    mockStripe.checkoutSessionsRetrieve.mockResolvedValueOnce({
      id: 'cs_test_123',
      status: 'complete',
      payment_status: 'paid',
      metadata: {
        application_id: '2',
        car_id: '',
        checkout_kind: 'application',
        payment_link_version: '1',
      },
    });
    const token = createCheckoutToken({
      applicationId: 2,
      carId: 1,
      purpose: 'vehicle',
      version: 1,
    });
    const res = await request(app).get('/api/stripe/checkout-sessions/cs_test_123').query({
      application_id: 2,
      car_id: 1,
      checkout_token: token.token,
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Checkout session does not match this payment link.');
  });

  it('GET /api/stripe/checkout-sessions/:id rejects sessions for the wrong vehicle', async () => {
    mockStripe.checkoutSessionsRetrieve.mockResolvedValueOnce({
      id: 'cs_test_123',
      status: 'complete',
      payment_status: 'paid',
      metadata: {
        application_id: '2',
        car_id: '2',
        checkout_kind: 'vehicle',
        payment_link_version: '1',
      },
    });
    const token = createCheckoutToken({
      applicationId: 2,
      carId: 1,
      purpose: 'vehicle',
      version: 1,
    });
    const res = await request(app).get('/api/stripe/checkout-sessions/cs_test_123').query({
      application_id: 2,
      car_id: 1,
      checkout_token: token.token,
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Checkout session does not match this vehicle link.');
  });

  it('POST /api/stripe/webhook activates the rental and records paid bond on success', async () => {
    mockStripe.webhooksConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_live_vehicle',
          payment_status: 'paid',
          metadata: {
            application_id: '2',
            approved_bond: '500.00',
            approved_weekly_price: '250.00',
            car_id: '1',
            checkout_kind: 'vehicle',
            payment_link_version: '1',
          },
          customer: 'cus_123',
          subscription: 'sub_123',
        },
      },
    });

    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('stripe-signature', 'test-signature')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(res.status).toBe(200);
    expect(mockState.cars[0].status).toBe('Rented');
    expect(mockState.applications[1].status).toBe('Paid');
    expect(mockState.applications[1].pending_checkout_session_id).toBeNull();
    expect(mockState.rentals[0]).toMatchObject({
      application_id: 2,
      car_id: 1,
      bond_paid: 500,
      weekly_price: 250,
      status: 'Active',
      stripe_subscription_id: 'sub_123',
    });
  });

  it('POST /api/stripe/webhook repairs an existing rental created before a retry', async () => {
    mockState.cars[0].status = 'Available';
    mockState.applications[1].status = 'Approved';
    mockState.rentals = [
      {
        id: 20,
        application_id: 2,
        car_id: 1,
        status: 'Pending',
        weekly_price: 0,
        bond_paid: 0,
        start_date: '2026-03-01',
      },
    ];
    mockStripe.webhooksConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_retry_vehicle',
          payment_status: 'paid',
          metadata: {
            application_id: '2',
            approved_bond: '500.00',
            approved_weekly_price: '250.00',
            car_id: '1',
            checkout_kind: 'vehicle',
            payment_link_version: '1',
          },
          customer: 'cus_123',
          subscription: 'sub_retry',
        },
      },
    });

    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('stripe-signature', 'test-signature')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(res.status).toBe(200);
    expect(mockState.rentals[0]).toMatchObject({
      bond_paid: 500,
      weekly_price: 250,
      status: 'Active',
      stripe_subscription_id: 'sub_retry',
    });
    expect(mockState.cars[0].status).toBe('Rented');
    expect(mockState.applications[1].status).toBe('Paid');
  });

  it('POST /api/stripe/webhook blocks duplicate vehicle activation for the same car', async () => {
    mockState.rentals = [
      {
        id: 20,
        application_id: 9,
        bond_paid: 500,
        car_id: 1,
        status: 'Active',
        weekly_price: 250,
        start_date: '2026-03-01',
      },
    ];
    mockStripe.webhooksConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_live_vehicle',
          payment_status: 'paid',
          metadata: {
            application_id: '2',
            approved_bond: '500.00',
            approved_weekly_price: '250.00',
            car_id: '1',
            checkout_kind: 'vehicle',
            payment_link_version: '1',
          },
          customer: 'cus_123',
          subscription: 'sub_123',
        },
      },
    });

    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('stripe-signature', 'test-signature')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(res.status).toBe(500);
    expect(mockState.rentals).toHaveLength(1);
    expect(mockState.rentals[0].application_id).toBe(9);
  });

  it('POST /api/stripe/webhook blocks vehicle activation when the car is under maintenance', async () => {
    mockState.cars[0].status = 'Maintenance';
    mockStripe.webhooksConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_vehicle_maintenance',
          payment_status: 'paid',
          metadata: {
            application_id: '2',
            approved_bond: '500.00',
            approved_weekly_price: '250.00',
            car_id: '1',
            checkout_kind: 'vehicle',
            payment_link_version: '1',
          },
          customer: 'cus_123',
          subscription: 'sub_maintenance',
        },
      },
    });

    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('stripe-signature', 'test-signature')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(res.status).toBe(500);
    expect(mockState.rentals).toHaveLength(0);
    expect(mockState.cars[0].status).toBe('Maintenance');
  });

  it('POST /api/stripe/webhook keeps the car rented when another live rental still exists', async () => {
    mockState.cars[0].status = 'Rented';
    mockState.rentals = [
      {
        id: 20,
        application_id: 2,
        bond_paid: 500,
        car_id: 1,
        status: 'Active',
        weekly_price: 250,
        start_date: '2026-03-01',
        stripe_subscription_id: 'sub_completed',
      },
      {
        id: 21,
        application_id: 9,
        bond_paid: 500,
        car_id: 1,
        status: 'Active',
        weekly_price: 260,
        start_date: '2026-03-05',
        stripe_subscription_id: 'sub_live',
      },
    ];
    mockStripe.webhooksConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_completed',
          metadata: {
            application_id: '2',
            car_id: '1',
          },
        },
      },
    });

    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('stripe-signature', 'test-signature')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(res.status).toBe(200);
    expect(mockState.cars[0].status).toBe('Rented');
    expect(mockState.rentals.find((rental) => rental.id === 20)?.status).toBe('Completed');
    expect(mockState.rentals.find((rental) => rental.id === 21)?.status).toBe('Active');
  });
});
