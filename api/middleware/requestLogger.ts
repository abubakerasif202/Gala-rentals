import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const TEST_MODE = process.env.VITEST === 'true';
const ASSET_PATH_REGEX =
  /\.(?:css|gif|ico|jpeg|jpg|js|map|png|svg|webp|woff2?)$/i;

const REDACTED_QUERY_VALUE = '[REDACTED]';
const REDACTED_QUERY_KEYS = new Set([
  'access_token',
  'admin_token',
  'checkout_token',
  'refresh_token',
  'token',
]);

const shouldSkipLogging = (req: Request) =>
  TEST_MODE ||
  req.path === '/api/health' ||
  req.path.startsWith('/assets/') ||
  req.path === '/favicon.ico' ||
  ASSET_PATH_REGEX.test(req.path);

const getRequestId = (req: Request) => {
  const headerValue = req.header('x-request-id');
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim().slice(0, 128);
  }

  return crypto.randomUUID();
};

const sanitizeOriginalUrl = (originalUrl: string) => {
  const [path, queryString] = originalUrl.split('?', 2);

  if (!queryString) {
    return originalUrl;
  }

  const query = new URLSearchParams(queryString);
  for (const key of REDACTED_QUERY_KEYS) {
    if (query.has(key)) {
      query.set(key, REDACTED_QUERY_VALUE);
    }
  }

  const sanitizedQuery = query.toString();
  return sanitizedQuery ? `${path}?${sanitizedQuery}` : path;
};

export const requestContext = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = getRequestId(req);
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
};

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (shouldSkipLogging(req)) {
    next();
    return;
  }

  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    const requestId = String(res.locals.requestId || '-');
    const forwardedFor = req.header('x-forwarded-for');
    const clientIp = forwardedFor
      ? forwardedFor.split(',')[0]?.trim()
      : req.ip;
    const safeOriginalUrl = sanitizeOriginalUrl(req.originalUrl);

    console.info(
      `[${requestId}] ${req.method} ${safeOriginalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms ip=${clientIp || '-'}`
    );
  });

  next();
};
