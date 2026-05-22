export type RequestLike = {
  method: string;
  path: string;
  get: (name: string) => string | undefined;
};

const PUBLIC_SPA_ROUTE_PATTERNS = [
  /^\/$/,
];

const PRIVATE_SPA_ROUTE_PATTERNS = [
  /^\/pricing\/?$/,
  /^\/cars\/?$/,
  /^\/cars\/[^/]+\/?$/,
  /^\/checkout\/?$/,
  /^\/checkout\/[^/]+\/?$/,
  /^\/apply\/?$/,
  /^\/application\/?$/,
  /^\/applications(?:\/.*)?$/,
  /^\/driver(?:\/.*)?$/,
  /^\/rental(?:\/.*)?$/,
  /^\/success\/?$/,
  /^\/agreement(?:\/.*)?$/,
  /^\/agreements(?:\/.*)?$/,
  /^\/toll(?:\/.*)?$/,
  /^\/toll-notices(?:\/.*)?$/,
  /^\/admin(?:\/.*)?$/,
];

const getPathname = (path: string) => {
  try {
    return new URL(path, 'https://www.maplerentals.com.au').pathname;
  } catch {
    return path;
  }
};

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

  return [...PUBLIC_SPA_ROUTE_PATTERNS, ...PRIVATE_SPA_ROUTE_PATTERNS].some(
    (pattern) => pattern.test(req.path)
  );
};

export const isPrivateSpaRoute = (path: string) => {
  const pathname = getPathname(path);
  return PRIVATE_SPA_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
};
