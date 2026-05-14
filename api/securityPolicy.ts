type ContentSecurityPolicyOptions = {
  cspReportUri?: string;
  cspReportingEnabled: boolean;
  supabaseUrl?: string;
};

const toOrigin = (value?: string) => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export const buildContentSecurityPolicyDirectives = ({
  cspReportUri,
  cspReportingEnabled,
  supabaseUrl,
}: ContentSecurityPolicyOptions) => {
  const supabaseOrigin = toOrigin(supabaseUrl);

  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://js.stripe.com'],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://fonts.googleapis.com',
    ],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    fontSrc: ["'self'", 'data:', 'https:'],
    connectSrc: [
      "'self'",
      supabaseOrigin || 'https://*.supabase.co',
      'https://*.supabase.co',
      'https://*.supabase.in',
    ],
    frameSrc: [
      "'self'",
      'blob:',
      'https://js.stripe.com',
      'https://hooks.stripe.com',
      'https://checkout.stripe.com',
    ],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: [],
    ...(cspReportingEnabled && cspReportUri
      ? { reportUri: [cspReportUri] }
      : {}),
  };
};
