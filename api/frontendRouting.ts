import type { Request } from 'express';

const SPA_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/pricing\/?$/,
  /^\/cars\/?$/,
  /^\/cars\/[^/]+\/?$/,
  /^\/checkout\/[^/]+\/?$/,
  /^\/apply\/?$/,
  /^\/success\/?$/,
  /^\/admin\/login\/?$/,
  /^\/admin\/dashboard\/?$/,
];

const acceptsHtmlNavigation = (req: Request) => {
  if (req.method === 'HEAD') {
    return true;
  }

  const acceptHeader = req.get('accept') || '';
  return acceptHeader.includes('text/html');
};

export const shouldServeSpaEntry = (req: Request) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    return false;
  }

  if (req.path.startsWith('/api/')) {
    return false;
  }

  if (req.path === '/') {
    return true;
  }

  if (!acceptsHtmlNavigation(req)) {
    return false;
  }

  return SPA_ROUTE_PATTERNS.some((pattern) => pattern.test(req.path));
};
