const TOKEN_KEYS = ['checkout_token', 'token'] as const;
const SESSION_STORAGE_PREFIX = 'gala-checkout-token:';

const getStorageKey = (applicationId: string, sessionId: string) =>
  `${SESSION_STORAGE_PREFIX}${applicationId}:${sessionId}`;

export const storeCheckoutToken = (
  storage: Pick<Storage, 'setItem'>,
  applicationId: string,
  sessionId: string,
  token: string
) => {
  if (applicationId && sessionId && token) {
    storage.setItem(getStorageKey(applicationId, sessionId), token);
  }
};

export const readStoredCheckoutToken = (
  storage: Pick<Storage, 'getItem'>,
  applicationId: string,
  sessionId: string
) => (applicationId && sessionId ? storage.getItem(getStorageKey(applicationId, sessionId)) || '' : '');

export const buildCheckoutTokenHash = (token: string) => {
  const params = new URLSearchParams();
  params.set('checkout_token', token);
  return `#${params.toString()}`;
};

export const resolveCheckoutToken = (
  searchParams: Pick<URLSearchParams, 'get'>,
  hashValue: string
) =>
  TOKEN_KEYS.map((key) => searchParams.get(key))
    .find((value) => value) || parseHashCheckoutToken(hashValue);

export const parseHashCheckoutToken = (hashValue: string) => {
  const params = new URLSearchParams(hashValue.startsWith('#') ? hashValue.slice(1) : hashValue);
  return TOKEN_KEYS.map((key) => params.get(key)).find((value) => value) || '';
};

export const scrubCheckoutTokenFromUrl = (url: URL) => {
  TOKEN_KEYS.forEach((key) => {
    url.searchParams.delete(key);
  });

  const hashToken = parseHashCheckoutToken(url.hash);
  if (hashToken) {
    url.hash = '';
  }

  return url;
};
