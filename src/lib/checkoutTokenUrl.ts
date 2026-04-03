const TOKEN_KEYS = ['checkout_token', 'token'] as const;

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
