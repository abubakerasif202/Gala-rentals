import crypto from 'node:crypto';
import express from 'express';
import { withPostgresTransaction } from '../db/postgres.js';

const router = express.Router();
router.get('/maintenance', async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (process.env.VERCEL_ENV !== 'production' || process.env.GALA_CRON_ENABLED !== 'true') {
    return res.status(503).json({ error: 'Scheduled maintenance is disabled.' });
  }
  const secret = process.env.CRON_SECRET?.trim();
  const provided = Buffer.from(req.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  if (!secret || provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Bounded and replay-safe. Retention deletion remains an explicit operator action.
  const deleted = await withPostgresTransaction(async client => {
    const result = await client.query(`DELETE FROM public.api_rate_limits WHERE key IN (
      SELECT key FROM public.api_rate_limits WHERE reset_at < now() - interval '1 day' LIMIT 10000
    )`);
    return result.rowCount;
  });
  return res.json({ status: 'ok', expiredRateLimitCountersRemoved: deleted });
});
export default router;
