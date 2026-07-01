import express from 'express';
import { z } from 'zod';

import { authenticateAdmin } from '../middleware/auth.js';
import {
  downloadDocumentPdfJobResult,
  getDocumentPdfJob,
  toDocumentPdfJobStatusResponse,
} from '../services/documentPdfJobs.js';

const router = express.Router();

const jobParamsSchema = z.object({
  id: z.string().uuid(),
});

router.get('/:id', authenticateAdmin, async (req, res) => {
  const parsed = jobParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
  }

  try {
    const job = await getDocumentPdfJob(parsed.data.id);
    if (!job) {
      return res.status(404).json({ error: 'Document PDF job not found' });
    }

    res.json(toDocumentPdfJobStatusResponse(job));
  } catch (error) {
    console.error('Document PDF job status error:', error);
    res.status(500).json({ error: 'Failed to fetch document PDF job status' });
  }
});

router.get('/:id/download', authenticateAdmin, async (req, res) => {
  const parsed = jobParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
  }

  try {
    const result = await downloadDocumentPdfJobResult(parsed.data.id);
    if (!result) {
      return res.status(404).json({ error: 'Document PDF job not found' });
    }

    if (result.pending) {
      return res.status(409).json({ error: 'Document PDF job is not complete' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`
    );
    res.send(result.buffer);
  } catch (error) {
    console.error('Document PDF job download error:', error);
    res.status(500).json({ error: 'Failed to download generated document PDF' });
  }
});

export default router;
