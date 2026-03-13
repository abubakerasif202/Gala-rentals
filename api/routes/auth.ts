import express from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';

import { createAuthClient } from '../db/index.js';
import { adminLoginSchema } from '../validation.js';

const router = express.Router();
const isVitest = process.env.VITEST === 'true';
const isProduction = process.env.NODE_ENV === 'production' && !isVitest;

const devAdminEmail = 'admin@maplerentals.com.au';
const devAdminPassword = (process.env.ADMIN_PASSWORD || '').trim();
const adminSessionSecret = (
  process.env.JWT_SECRET ||
  process.env.CHECKOUT_LINK_SECRET ||
  ''
).trim();
const LOCAL_ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ACCESS_TOKEN_REFRESH_WINDOW_MS = 60 * 1000;
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => process.env.VITEST === 'true',
  message: { error: 'Too many login attempts. Try again later.' },
});

type LocalAdminSessionPayload = {
  email: string;
  exp: number;
  mode: 'local-admin';
};

type SupabaseAdminSessionPayload = {
  accessToken: string;
  accessTokenExpiresAt: number | null;
  email: string;
  exp: number;
  mode: 'supabase-admin';
  refreshToken: string;
};

type AdminSessionPayload =
  | LocalAdminSessionPayload
  | SupabaseAdminSessionPayload;

const canUseLocalAdminSession =
  !isProduction && Boolean(devAdminPassword && adminSessionSecret);

const getEffectiveAdminEmail = () => {
  const configuredAdminEmail = (process.env.ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();

  if (configuredAdminEmail) {
    return configuredAdminEmail;
  }

  if (!isProduction) {
    return devAdminEmail;
  }

  return null;
};

const getRequestOrigin = (req: express.Request) => {
  const host = req.get('host');

  if (!host) {
    return null;
  }

  const forwardedProto = req.get('x-forwarded-proto');
  const protocol =
    forwardedProto?.split(',')[0]?.trim() || (req.secure ? 'https' : 'http');

  return `${protocol}://${host}`;
};

const isCrossSiteCookieRequest = (req: express.Request) => {
  const requestOrigin = getRequestOrigin(req);
  const originHeader = req.get('origin');

  if (!requestOrigin || !originHeader) {
    return false;
  }

  try {
    const requestUrl = new URL(requestOrigin);
    const originUrl = new URL(originHeader);

    return (
      requestUrl.protocol !== originUrl.protocol ||
      requestUrl.hostname !== originUrl.hostname
    );
  } catch {
    return false;
  }
};

const createCookieOptions = (req: express.Request) => {
  const requiresCrossSiteCookie = isCrossSiteCookieRequest(req);

  return {
    httpOnly: true,
    maxAge: LOCAL_ADMIN_SESSION_TTL_MS,
    path: '/',
    sameSite: (requiresCrossSiteCookie ? 'none' : 'strict') as
      | 'none'
      | 'strict',
    secure: isProduction || requiresCrossSiteCookie,
  };
};

const signAdminSessionValue = (value: string) =>
  crypto.createHmac('sha256', adminSessionSecret).update(value).digest('base64url');

const createSignedSessionToken = (payload: AdminSessionPayload) => {
  if (!adminSessionSecret) {
    throw new Error(
      'CHECKOUT_LINK_SECRET or JWT_SECRET is required to issue admin sessions.'
    );
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  );

  return `${encodedPayload}.${signAdminSessionValue(encodedPayload)}`;
};

const createLocalAdminSessionToken = (email: string) =>
  createSignedSessionToken({
    email,
    exp: Date.now() + LOCAL_ADMIN_SESSION_TTL_MS,
    mode: 'local-admin',
  });

const createSupabaseAdminSessionToken = ({
  accessToken,
  accessTokenExpiresAt,
  email,
  refreshToken,
}: {
  accessToken: string;
  accessTokenExpiresAt: number | null;
  email: string;
  refreshToken: string;
}) =>
  createSignedSessionToken({
    accessToken,
    accessTokenExpiresAt,
    email,
    exp: Date.now() + LOCAL_ADMIN_SESSION_TTL_MS,
    mode: 'supabase-admin',
    refreshToken,
  });

const verifySignedSessionToken = (token: string) => {
  if (!adminSessionSecret) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split('.');
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signAdminSessionValue(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as Partial<AdminSessionPayload>;

    if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

const verifyLocalAdminSessionToken = (token: string) => {
  if (!canUseLocalAdminSession) {
    return null;
  }

  const payload = verifySignedSessionToken(token);
  if (!payload || payload.mode !== 'local-admin') {
    return null;
  }

  if (typeof payload.email !== 'string') {
    return null;
  }

  return payload as LocalAdminSessionPayload;
};

const verifySupabaseAdminSessionToken = (token: string) => {
  const payload = verifySignedSessionToken(token);
  if (!payload || payload.mode !== 'supabase-admin') {
    return null;
  }

  if (
    typeof payload.email !== 'string' ||
    typeof payload.accessToken !== 'string' ||
    typeof payload.refreshToken !== 'string'
  ) {
    return null;
  }

  return payload as SupabaseAdminSessionPayload;
};

const clearAdminSessionCookie = (req: express.Request, res: express.Response) => {
  res.clearCookie('admin_token', createCookieOptions(req));
};

const getSupabaseSessionExpiry = (
  session:
    | {
        expires_at?: number | null;
      }
    | null
    | undefined
) => {
  if (
    typeof session?.expires_at === 'number' &&
    Number.isFinite(session.expires_at)
  ) {
    return session.expires_at * 1000;
  }

  return null;
};

const shouldRefreshSupabaseSession = (
  session: SupabaseAdminSessionPayload
) =>
  typeof session.accessTokenExpiresAt === 'number' &&
  session.accessTokenExpiresAt <= Date.now() + ACCESS_TOKEN_REFRESH_WINDOW_MS;

const getBearerToken = (req: express.Request) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length).trim() || null;
};

const authenticateSupabaseAdminToken = async (
  token: string,
  effectiveAdminEmail: string
) => {
  const authClient = createAuthClient();
  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  if (data.user.email?.toLowerCase() !== effectiveAdminEmail) {
    return { accessDenied: true as const, user: null };
  }

  return { accessDenied: false as const, user: data.user };
};

const refreshSupabaseAdminSession = async (
  req: express.Request,
  res: express.Response,
  session: SupabaseAdminSessionPayload,
  effectiveAdminEmail: string
) => {
  const authClient = createAuthClient();
  const { data, error } = await authClient.auth.refreshSession({
    refresh_token: session.refreshToken,
  });

  if (error || !data.session || !data.user) {
    clearAdminSessionCookie(req, res);
    return null;
  }

  if (data.user.email?.toLowerCase() !== effectiveAdminEmail) {
    clearAdminSessionCookie(req, res);
    return { accessDenied: true as const, user: null };
  }

  res.cookie(
    'admin_token',
    createSupabaseAdminSessionToken({
      accessToken: data.session.access_token,
      accessTokenExpiresAt: getSupabaseSessionExpiry(data.session),
      email: data.user.email || effectiveAdminEmail,
      refreshToken: data.session.refresh_token,
    }),
    createCookieOptions(req)
  );

  return { accessDenied: false as const, user: data.user };
};

export const authenticateAdmin = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const token = req.cookies.admin_token || getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const effectiveAdminEmail = getEffectiveAdminEmail();
    if (!effectiveAdminEmail) {
      return res
        .status(500)
        .json({ error: 'Admin authentication is not configured' });
    }

    const localAdminSession = verifyLocalAdminSessionToken(token);
    if (localAdminSession?.email.toLowerCase() === effectiveAdminEmail) {
      req.admin = { email: localAdminSession.email };
      next();
      return;
    }

    const supabaseAdminSession = verifySupabaseAdminSessionToken(token);
    if (supabaseAdminSession) {
      const sessionResult = shouldRefreshSupabaseSession(supabaseAdminSession)
        ? await refreshSupabaseAdminSession(
            req,
            res,
            supabaseAdminSession,
            effectiveAdminEmail
          )
        : (await authenticateSupabaseAdminToken(
            supabaseAdminSession.accessToken,
            effectiveAdminEmail
          )) ||
          (await refreshSupabaseAdminSession(
            req,
            res,
            supabaseAdminSession,
            effectiveAdminEmail
          ));

      if (!sessionResult?.user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      if (sessionResult.accessDenied) {
        return res
          .status(403)
          .json({ error: 'Access denied: Unauthorized email' });
      }

      req.admin = sessionResult.user;
      next();
      return;
    }

    const tokenResult = await authenticateSupabaseAdminToken(
      token,
      effectiveAdminEmail
    );
    if (!tokenResult?.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (tokenResult.accessDenied) {
      return res
        .status(403)
        .json({ error: 'Access denied: Unauthorized email' });
    }

    req.admin = tokenResult.user;
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const effectiveAdminEmail = getEffectiveAdminEmail();
    if (!effectiveAdminEmail) {
      return res
        .status(500)
        .json({ error: 'Admin authentication is not configured' });
    }

    const { username, password } = adminLoginSchema.parse(req.body ?? {});
    const email = username.trim().toLowerCase();
    const pass = password;

    if (email !== effectiveAdminEmail) {
      return res.status(403).json({
        error: 'Unauthorized: Access restricted to primary admin',
      });
    }

    if (canUseLocalAdminSession && pass === devAdminPassword) {
      res.cookie(
        'admin_token',
        createLocalAdminSessionToken(email),
        createCookieOptions(req)
      );
      return res.json({ username: email });
    }

    const authClient = createAuthClient();
    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error || !data.session) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!data.session.refresh_token) {
      throw new Error('Supabase session is missing a refresh token.');
    }

    res.cookie(
      'admin_token',
      createSupabaseAdminSessionToken({
        accessToken: data.session.access_token,
        accessTokenExpiresAt: getSupabaseSessionExpiry(data.session),
        email: data.user?.email || email,
        refreshToken: data.session.refresh_token,
      }),
      createCookieOptions(req)
    );
    res.json({ username: data.user?.email });
  } catch (err) {
    if (err instanceof ZodError) {
      return res
        .status(400)
        .json({ error: 'Validation failed', details: err.issues });
    }

    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', async (req, res) => {
  clearAdminSessionCookie(req, res);
  res.json({ message: 'Logged out' });
});

router.get('/verify', authenticateAdmin, (req, res) => {
  const adminEmail = req.admin?.email;

  if (!adminEmail) {
    return res
      .status(500)
      .json({ error: 'Admin session is missing an email address' });
  }

  return res.json({ user: { username: adminEmail } });
});

export default router;
