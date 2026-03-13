import express from 'express';
import crypto from 'node:crypto';
import { createAuthClient } from '../db/index.js';

const router = express.Router();
const isProduction = process.env.NODE_ENV === 'production';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
if (!ADMIN_EMAIL && isProduction) {
  throw new Error('CRITICAL: ADMIN_EMAIL environment variable is missing in production!');
}

const devAdminEmail = 'admin@maplerentals.com.au';
const effectiveAdminEmail = (ADMIN_EMAIL || devAdminEmail).toLowerCase();
const devAdminPassword = (process.env.ADMIN_PASSWORD || '').trim();
const localAdminSessionSecret = (
  process.env.JWT_SECRET ||
  process.env.CHECKOUT_LINK_SECRET ||
  ''
).trim();
const LOCAL_ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

type LocalAdminSessionPayload = {
  email: string;
  exp: number;
  mode: 'local-admin';
};

const canUseLocalAdminSession =
  !isProduction && Boolean(devAdminPassword && localAdminSessionSecret);

const createCookieOptions = () => ({
  httpOnly: true,
  maxAge: LOCAL_ADMIN_SESSION_TTL_MS,
  sameSite: 'lax' as const,
  secure: isProduction,
});

const signLocalAdminSessionValue = (value: string) =>
  crypto.createHmac('sha256', localAdminSessionSecret).update(value).digest('base64url');

const createLocalAdminSessionToken = (email: string) => {
  const payload = Buffer.from(
    JSON.stringify({
      email,
      exp: Date.now() + LOCAL_ADMIN_SESSION_TTL_MS,
      mode: 'local-admin',
    } satisfies LocalAdminSessionPayload),
    'utf8'
  ).toString('base64url');

  return `${payload}.${signLocalAdminSessionValue(payload)}`;
};

const verifyLocalAdminSessionToken = (token: string) => {
  if (!canUseLocalAdminSession) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split('.');
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signLocalAdminSessionValue(encodedPayload);
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
    ) as Partial<LocalAdminSessionPayload>;

    if (
      payload.mode !== 'local-admin' ||
      typeof payload.email !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp <= Date.now()
    ) {
      return null;
    }

    return payload as LocalAdminSessionPayload;
  } catch {
    return null;
  }
};

export const authenticateAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies.admin_token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const localAdminSession = verifyLocalAdminSessionToken(token);
    if (localAdminSession?.email.toLowerCase() === effectiveAdminEmail) {
      (req as any).admin = { email: localAdminSession.email };
      next();
      return;
    }

    const authClient = createAuthClient();
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Single-Admin Email Whitelist Check
    if (data.user.email?.toLowerCase() !== effectiveAdminEmail) {
      return res.status(403).json({ error: 'Access denied: Unauthorized email' });
    }

    (req as any).admin = data.user;
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const email = typeof username === 'string' ? username.trim().toLowerCase() : '';
  const pass = typeof password === 'string' ? password : '';

  if (!email || !pass) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Single-Admin Email Whitelist Check
  if (email !== effectiveAdminEmail) {
    return res.status(403).json({ error: 'Unauthorized: Access restricted to primary admin' });
  }

  if (canUseLocalAdminSession && pass === devAdminPassword) {
    res.cookie('admin_token', createLocalAdminSessionToken(email), createCookieOptions());
    return res.json({ username: email });
  }

  try {
    const authClient = createAuthClient();
    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error || !data.session) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = data.session.access_token;
    res.cookie('admin_token', token, createCookieOptions());
    res.json({ username: data.user?.email });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', async (_req, res) => {
  res.clearCookie('admin_token', createCookieOptions());
  res.json({ message: 'Logged out' });
});

router.get('/verify', authenticateAdmin, (req, res) => {
  res.json({ user: { username: (req as any).admin.email } });
});

export default router;
