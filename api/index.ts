import '../scripts/load-env.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { checkDBHealth, initializeDB } from './db/index.js';

// Route Imports
import authRoutes from './routes/auth.js';
import carRoutes from './routes/cars.js';
import applicationRoutes from './routes/applications.js';
import inquiryRoutes from './routes/inquiries.js';
import stripeRoutes from './routes/stripe.js';
import rentalRoutes from './routes/rentals.js';
import agreementRoutes from './routes/agreements.js';
import financialRoutes from './routes/financials.js';
import webhookRoutes from './routes/webhooks.js';
import customerRoutes from './routes/customers.js';
import invoiceRoutes from './routes/invoices.js';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const shouldListen = process.env.VITEST !== 'true';
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const JSON_BODY_LIMIT = '25mb';
const frontendDistDir = path.resolve(process.cwd(), 'dist');
const frontendIndexPath = path.join(frontendDistDir, 'index.html');
const validateProductionEnv = () => {
  if (!isProduction) {
    return;
  }

  const missing = [
    'APP_URL',
    'CHECKOUT_LINK_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
};

// CORS Configuration
const toOrigin = (value?: string) => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const corsOrigins = [
  toOrigin(process.env.APP_URL),
  toOrigin(process.env.FRONTEND_URL),
  process.env.CORS_ORIGIN || null,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter((origin): origin is string => Boolean(origin));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  })
);

app.use(cookieParser());

// Webhooks (MUST be before express.json() for raw body)
app.use('/api/webhook/stripe', webhookRoutes);
app.use('/api/stripe/webhook', webhookRoutes);

// Allow room for two base64-encoded licence images plus form fields.
app.use(express.json({ limit: JSON_BODY_LIMIT }));

// Database Initialization Middleware
let dbInitialized: Promise<void> | null = null;
const ensureDB = async () => {
  if (!dbInitialized) {
    dbInitialized = initializeDB();
  }
  return dbInitialized;
};

app.get('/api/health', async (_req, res) => {
  try {
    const { configured } = await checkDBHealth();

    res.json({
      status: 'ok',
      environment: process.env.NODE_ENV || 'development',
      database: configured ? 'ok' : 'not_configured',
    });
  } catch (error) {
    console.error('Healthcheck error:', error);
    res.status(503).json({
      status: 'error',
      environment: process.env.NODE_ENV || 'development',
      database: 'unavailable',
    });
  }
});

app.use('/api', async (_req, res, next) => {
  try {
    await ensureDB();
    next();
  } catch (err) {
    console.error('Database initialization error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/agreements', agreementRoutes);
app.use('/api/financials', financialRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);

// Legacy/Compatibility Redirects or Aliases
app.get('/api/stats', (_req, res) => res.redirect(307, '/api/financials/stats'));
app.get('/api/rental-plans', (_req, res) => res.redirect(307, '/api/stripe/rental-plans'));

// Server Startup
const startServer = async () => {
  validateProductionEnv();
  await ensureDB();

  if (!isProduction) {
    const { ensureEsbuildBinaryPath } = await import('../scripts/ensureEsbuildBinaryPath.js');
    ensureEsbuildBinaryPath();
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(frontendDistDir, { index: false }));
    app.use((req, res, next) => {
      if (!['GET', 'HEAD'].includes(req.method) || req.path.startsWith('/api/')) {
        next();
        return;
      }

      res.sendFile(frontendIndexPath, (err) => {
        if (err) {
          next(err);
        }
      });
    });
  }

  if (shouldListen) {
    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
    });
  }
};

if (shouldListen) {
  void startServer().catch((error) => {
    console.error('Server startup error:', error);
    process.exit(1);
  });
}

export default app;
