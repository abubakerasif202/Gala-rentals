export type RequestLike = {
  method: string;
  path: string;
  get: (name: string) => string | undefined;
};

const SPA_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/fleet\/?$/,
  /^\/fleet\/[^/]+\/?$/,
  /^\/vehicles\/?$/,
  /^\/vehicles\/[^/]+\/?$/,
  /^\/pricing\/?$/,
  /^\/cars\/?$/,
  /^\/cars\/[^/]+\/?$/,
  /^\/checkout\/[^/]+\/?$/,
  /^\/apply\/?$/,
  /^\/faq\/?$/,
  /^\/contact\/?$/,
  /^\/my-rental\/?$/,
  /^\/success\/?$/,
  /^\/admin\/login\/?$/,
  /^\/admin\/dashboard\/?$/,
  /^\/admin\/agreements\/?$/,
  /^\/admin\/toll-notices\/?$/,
];

const acceptsHtmlNavigation = (req: RequestLike) => {
  if (req.method === 'HEAD') {
    return true;
  }

  const acceptHeader = req.get('accept') || '';
  return acceptHeader.includes('text/html');
};

export const shouldServeSpaEntry = (req: RequestLike) => {
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
