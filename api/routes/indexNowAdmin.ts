import express from 'express';
import { z } from 'zod';
import { submitIndexNowUrls } from '../services/indexNow.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

const payloadSchema = z.object({
  url: z.string().url().optional(),
  urls: z.array(z.string().url()).optional(),
});

router.post('/test-indexnow', authenticateAdmin, async (req, res) => {
  try {
    const payload = payloadSchema.parse(req.body);
    const urls = [payload.url, ...(payload.urls || [])].filter((url): url is string => Boolean(url));

    if (urls.length === 0) {
      return res.status(400).json({ error: 'Provide url or urls[] in request body.' });
    }

    const result = await submitIndexNowUrls(urls);
    return res.json({ success: true, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    console.error('IndexNow manual submit error:', error);
    return res.status(500).json({ error: 'Failed to submit IndexNow URLs' });
  }
});

export default router;
