#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const PROFILES = {
  smoke: [
    { name: 'live', path: '/api/live', weight: 4, expectedStatuses: [200] },
    { name: 'health', path: '/api/health', weight: 1, expectedStatuses: [200] },
  ],
  'read-only-api': [
    { name: 'live', path: '/api/live', weight: 3, expectedStatuses: [200] },
    { name: 'health', path: '/api/health', weight: 1, expectedStatuses: [200] },
    {
      name: 'rental-plans',
      path: '/api/stripe/rental-plans',
      weight: 2,
      expectedStatuses: [200],
    },
    {
      name: 'lease-settings',
      path: '/api/stripe/lease-settings',
      weight: 2,
      expectedStatuses: [200],
    },
  ],
  'public-pages': [
    { name: 'home', path: '/', weight: 3, expectedStatuses: [200] },
    { name: 'pricing', path: '/pricing', weight: 2, expectedStatuses: [200] },
    { name: 'apply', path: '/apply', weight: 1, expectedStatuses: [200] },
    { name: 'faq', path: '/faq', weight: 1, expectedStatuses: [200] },
    { name: 'contact', path: '/contact', weight: 1, expectedStatuses: [200] },
  ],
};

const KNOWN_PRODUCTION_HOSTS = new Set([
  'galarentals.com.au',
  'www.galarentals.com.au',
  'gala-rentals.com.au',
  'www.gala-rentals.com.au',
  'gala-rentals.onrender.com',
]);

const HELP = `
Gala Rentals read-only load test runner

Usage:
  node scripts/load-test.mjs [options]

Options:
  --base-url=<url>            Target base URL. Default: LOAD_TEST_BASE_URL or http://localhost:3000
  --profile=<name>            smoke, read-only-api, public-pages. Default: LOAD_TEST_PROFILE or read-only-api
  --duration=<seconds>        Test duration. Default: LOAD_TEST_DURATION_SECONDS or 60
  --concurrency=<count>       Concurrent workers. Default: LOAD_TEST_CONCURRENCY or 8
  --ramp=<seconds>            Ramp-up period. Default: LOAD_TEST_RAMP_SECONDS or 10
  --request-delay=<ms>        Delay after each worker request. Default: LOAD_TEST_REQUEST_DELAY_MS or 50
  --timeout=<ms>              Per-request timeout. Default: LOAD_TEST_TIMEOUT_MS or 5000
  --p95=<ms>                  Aggregate p95 threshold. Default: LOAD_TEST_P95_MS or 1000
  --p99=<ms>                  Aggregate p99 threshold. Default: LOAD_TEST_P99_MS or 2500
  --max-error-rate=<decimal>  Aggregate error-rate threshold. Default: LOAD_TEST_MAX_ERROR_RATE or 0.01
  --output=<path>             JSON result path. Default: LOAD_TEST_OUTPUT or tmp/load-test/latest.json
  --allow-production          Required for known Gala production hosts.
  --help                      Show this help.
`;

const parseArgs = (argv) => {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const [rawKey, rawValue] = arg.slice(2).split('=', 2);
    const key = rawKey.trim();

    if (!key) {
      throw new Error(`Invalid argument: ${arg}`);
    }

    if (rawValue !== undefined) {
      args[key] = rawValue;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
      continue;
    }

    args[key] = true;
  }

  return args;
};

const parseNumber = ({ name, rawValue, defaultValue, min, integer = false }) => {
  const resolved = rawValue === undefined || rawValue === '' ? defaultValue : Number(rawValue);

  if (!Number.isFinite(resolved) || resolved < min || (integer && !Number.isInteger(resolved))) {
    throw new Error(
      `${name} must be ${integer ? 'an integer' : 'a number'} greater than or equal to ${min}.`
    );
  }

  return resolved;
};

const parseBoolean = (value) => {
  if (value === true) {
    return true;
  }

  if (typeof value !== 'string') {
    return false;
  }

  return ['1', 'true', 'yes', 'y'].includes(value.trim().toLowerCase());
};

const resolveConfig = () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    return { help: true };
  }

  const baseUrl = String(
    args['base-url'] || process.env.LOAD_TEST_BASE_URL || 'http://localhost:3000'
  );
  const profileName = String(
    args.profile || process.env.LOAD_TEST_PROFILE || 'read-only-api'
  );
  const profile = PROFILES[profileName];

  if (!profile) {
    throw new Error(
      `Unknown profile "${profileName}". Use one of: ${Object.keys(PROFILES).join(', ')}.`
    );
  }

  let target;
  try {
    target = new URL(baseUrl);
  } catch {
    throw new Error(`LOAD_TEST_BASE_URL must be an absolute URL. Received: ${baseUrl}`);
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new Error('LOAD_TEST_BASE_URL must use http or https.');
  }

  const allowProduction =
    parseBoolean(args['allow-production']) ||
    parseBoolean(process.env.LOAD_TEST_ALLOW_PRODUCTION);
  const hostname = target.hostname.toLowerCase();
  if (KNOWN_PRODUCTION_HOSTS.has(hostname) && !allowProduction) {
    throw new Error(
      [
        `Refusing to load test known Gala production host "${hostname}".`,
        'Use a local/staging URL, or set LOAD_TEST_ALLOW_PRODUCTION=true after approval.',
      ].join(' ')
    );
  }

  return {
    allowProduction,
    baseUrl: target.origin,
    concurrency: parseNumber({
      name: 'concurrency',
      rawValue: args.concurrency || process.env.LOAD_TEST_CONCURRENCY,
      defaultValue: 8,
      min: 1,
      integer: true,
    }),
    durationSeconds: parseNumber({
      name: 'duration',
      rawValue: args.duration || process.env.LOAD_TEST_DURATION_SECONDS,
      defaultValue: 60,
      min: 1,
    }),
    maxErrorRate: parseNumber({
      name: 'max-error-rate',
      rawValue: args['max-error-rate'] || process.env.LOAD_TEST_MAX_ERROR_RATE,
      defaultValue: 0.01,
      min: 0,
    }),
    outputPath: path.resolve(
      String(args.output || process.env.LOAD_TEST_OUTPUT || 'tmp/load-test/latest.json')
    ),
    p95ThresholdMs: parseNumber({
      name: 'p95',
      rawValue: args.p95 || process.env.LOAD_TEST_P95_MS,
      defaultValue: 1000,
      min: 1,
    }),
    p99ThresholdMs: parseNumber({
      name: 'p99',
      rawValue: args.p99 || process.env.LOAD_TEST_P99_MS,
      defaultValue: 2500,
      min: 1,
    }),
    profile,
    profileName,
    rampSeconds: parseNumber({
      name: 'ramp',
      rawValue: args.ramp || process.env.LOAD_TEST_RAMP_SECONDS,
      defaultValue: 10,
      min: 0,
    }),
    requestDelayMs: parseNumber({
      name: 'request-delay',
      rawValue: args['request-delay'] || process.env.LOAD_TEST_REQUEST_DELAY_MS,
      defaultValue: 50,
      min: 0,
    }),
    timeoutMs: parseNumber({
      name: 'timeout',
      rawValue: args.timeout || process.env.LOAD_TEST_TIMEOUT_MS,
      defaultValue: 5000,
      min: 1,
    }),
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createEndpointPicker = (profile) => {
  const cumulative = [];
  let total = 0;

  for (const endpoint of profile) {
    total += endpoint.weight;
    cumulative.push({ total, endpoint });
  }

  return () => {
    const roll = Math.random() * total;
    return cumulative.find((entry) => roll < entry.total)?.endpoint || profile[0];
  };
};

const percentile = (values, quantile) => {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1);
  return sorted[index];
};

const summarize = (results) => {
  const durationValues = results.map((result) => result.durationMs);
  const failed = results.filter((result) => !result.ok).length;
  const bytes = results.reduce((total, result) => total + result.bytes, 0);
  const statusCodes = {};

  for (const result of results) {
    const key = String(result.status || 'error');
    statusCodes[key] = (statusCodes[key] || 0) + 1;
  }

  return {
    bytes,
    count: results.length,
    errorRate: results.length ? failed / results.length : 1,
    failed,
    maxMs: Math.max(0, ...durationValues),
    minMs: Math.min(...durationValues),
    p50Ms: percentile(durationValues, 0.5),
    p95Ms: percentile(durationValues, 0.95),
    p99Ms: percentile(durationValues, 0.99),
    statusCodes,
  };
};

const summarizeByEndpoint = (results) => {
  const grouped = new Map();

  for (const result of results) {
    const values = grouped.get(result.name) || [];
    values.push(result);
    grouped.set(result.name, values);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, endpointResults]) => ({
      name,
      ...summarize(endpointResults),
    }));
};

const round = (value, digits = 1) => Number(value.toFixed(digits));

const formatErrorRate = (value) => `${round(value * 100, 2)}%`;

const formatTable = (rows, columns) => {
  const widths = {};

  for (const column of columns) {
    widths[column.key] = Math.max(
      column.label.length,
      ...rows.map((row) => String(row[column.key]).length)
    );
  }

  const formatRow = (row) =>
    columns.map((column) => String(row[column.key]).padEnd(widths[column.key])).join(' | ');

  return [
    formatRow(Object.fromEntries(columns.map((column) => [column.key, column.label]))),
    columns.map((column) => '-'.repeat(widths[column.key])).join('-|-'),
    ...rows.map(formatRow),
  ].join('\n');
};

const runRequest = async ({ endpoint, config }) => {
  const url = new URL(endpoint.path, config.baseUrl);
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        'user-agent': 'gala-rentals-load-test/1.0',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    const body = await response.arrayBuffer();
    const durationMs = performance.now() - startedAt;
    const ok = endpoint.expectedStatuses.includes(response.status);

    return {
      bytes: body.byteLength,
      durationMs,
      error: ok ? null : `Expected ${endpoint.expectedStatuses.join('/')} got ${response.status}`,
      name: endpoint.name,
      ok,
      path: endpoint.path,
      status: response.status,
    };
  } catch (error) {
    return {
      bytes: 0,
      durationMs: performance.now() - startedAt,
      error: error instanceof Error ? error.message : 'Request failed',
      name: endpoint.name,
      ok: false,
      path: endpoint.path,
      status: null,
    };
  }
};

const runWorker = async ({ config, endAt, id, pickEndpoint, results }) => {
  if (config.rampSeconds > 0 && config.concurrency > 1) {
    const rampDelayMs = (id * config.rampSeconds * 1000) / (config.concurrency - 1);
    await sleep(rampDelayMs);
  }

  while (Date.now() < endAt) {
    const result = await runRequest({
      config,
      endpoint: pickEndpoint(),
    });
    results.push(result);

    if (config.requestDelayMs > 0) {
      await sleep(config.requestDelayMs);
    }
  }
};

const runLoadTest = async (config) => {
  const startedAt = new Date();
  const endAt = Date.now() + config.durationSeconds * 1000;
  const pickEndpoint = createEndpointPicker(config.profile);
  const results = [];
  const workers = Array.from({ length: config.concurrency }, (_value, id) =>
    runWorker({ config, endAt, id, pickEndpoint, results })
  );

  await Promise.all(workers);

  const finishedAt = new Date();
  const elapsedSeconds = (finishedAt.getTime() - startedAt.getTime()) / 1000;
  const summary = summarize(results);
  const endpoints = summarizeByEndpoint(results);
  const thresholds = {
    errorRate: {
      actual: summary.errorRate,
      limit: config.maxErrorRate,
      pass: summary.errorRate <= config.maxErrorRate,
    },
    p95Ms: {
      actual: summary.p95Ms,
      limit: config.p95ThresholdMs,
      pass: summary.p95Ms <= config.p95ThresholdMs,
    },
    p99Ms: {
      actual: summary.p99Ms,
      limit: config.p99ThresholdMs,
      pass: summary.p99Ms <= config.p99ThresholdMs,
    },
  };
  const passed =
    results.length > 0 &&
    thresholds.errorRate.pass &&
    thresholds.p95Ms.pass &&
    thresholds.p99Ms.pass;

  return {
    config: {
      baseUrl: config.baseUrl,
      concurrency: config.concurrency,
      durationSeconds: config.durationSeconds,
      profile: config.profileName,
      rampSeconds: config.rampSeconds,
      requestDelayMs: config.requestDelayMs,
      timeoutMs: config.timeoutMs,
    },
    endpoints,
    elapsedSeconds,
    finishedAt: finishedAt.toISOString(),
    passed,
    startedAt: startedAt.toISOString(),
    summary,
    thresholds,
  };
};

const printReport = (report) => {
  const rows = [
    {
      endpoint: 'aggregate',
      requests: report.summary.count,
      failed: report.summary.failed,
      errorRate: formatErrorRate(report.summary.errorRate),
      p50: round(report.summary.p50Ms),
      p95: round(report.summary.p95Ms),
      p99: round(report.summary.p99Ms),
      max: round(report.summary.maxMs),
    },
    ...report.endpoints.map((endpoint) => ({
      endpoint: endpoint.name,
      requests: endpoint.count,
      failed: endpoint.failed,
      errorRate: formatErrorRate(endpoint.errorRate),
      p50: round(endpoint.p50Ms),
      p95: round(endpoint.p95Ms),
      p99: round(endpoint.p99Ms),
      max: round(endpoint.maxMs),
    })),
  ];

  console.log(
    [
      '',
      'Gala Rentals load test result',
      `Target: ${report.config.baseUrl}`,
      `Profile: ${report.config.profile}`,
      `Duration: ${round(report.elapsedSeconds, 2)}s`,
      '',
      formatTable(rows, [
        { key: 'endpoint', label: 'endpoint' },
        { key: 'requests', label: 'requests' },
        { key: 'failed', label: 'failed' },
        { key: 'errorRate', label: 'error rate' },
        { key: 'p50', label: 'p50 ms' },
        { key: 'p95', label: 'p95 ms' },
        { key: 'p99', label: 'p99 ms' },
        { key: 'max', label: 'max ms' },
      ]),
      '',
      `Thresholds: p95 <= ${report.thresholds.p95Ms.limit}ms, p99 <= ${report.thresholds.p99Ms.limit}ms, error rate <= ${formatErrorRate(report.thresholds.errorRate.limit)}`,
      `Status: ${report.passed ? 'PASS' : 'FAIL'}`,
    ].join('\n')
  );
};

const main = async () => {
  const config = resolveConfig();

  if (config.help) {
    console.log(HELP.trim());
    return;
  }

  console.log(
    `Running ${config.profileName} load test against ${config.baseUrl} for ${config.durationSeconds}s with ${config.concurrency} workers.`
  );

  const report = await runLoadTest(config);
  await mkdir(path.dirname(config.outputPath), { recursive: true });
  await writeFile(config.outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  printReport(report);
  console.log(`JSON result: ${config.outputPath}`);

  if (!report.passed) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
