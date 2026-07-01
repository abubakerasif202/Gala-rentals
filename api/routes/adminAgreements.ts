import express from 'express';
import { z } from 'zod';

import {
  DEFAULT_AGREEMENT_TEMPLATE_KEY,
  fetchActiveAgreementTemplate,
  fetchAgreementTemplateById,
  fetchAgreementTemplates,
} from '../agreementTemplates.js';
import { db } from '../db/index.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { createAgreementPdfJob } from '../services/documentPdfJobs.js';
import { renderCarLeaseAgreementTemplate } from '../templates/carLeaseAgreement.js';
import { buildCarLeaseAgreementPdf } from '../templates/carLeaseAgreementPdf.js';
import {
  agreementTemplateSchema,
  leaseAgreementSchema,
  updateAgreementTemplateSchema,
} from '../validation.js';

const router = express.Router();

const idParamsSchema = z.object({ id: z.coerce.number().int().nonnegative() });
const previewAgreementTemplateSchema = leaseAgreementSchema.extend({
  content: z.string().trim().min(1).max(50000).optional(),
});
const adminActorFromRequest = (req: express.Request) =>
  ('email' in (req.admin || {}) ? req.admin?.email : undefined) || 'admin';

router.get('/', authenticateAdmin, async (_req, res) => {
  try {
    res.json(await fetchAgreementTemplates());
  } catch (error) {
    console.error('Fetch agreement templates error:', error);
    res.status(500).json({ error: 'Failed to fetch agreement templates' });
  }
});

router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsedParams.error.issues });
    }

    const template = await fetchAgreementTemplateById(parsedParams.data.id);
    if (!template) {
      return res.status(404).json({ error: 'Agreement template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Fetch agreement template error:', error);
    res.status(500).json({ error: 'Failed to fetch agreement template' });
  }
});

router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const payload = agreementTemplateSchema.parse(req.body ?? {});
    const activeTemplate = await fetchActiveAgreementTemplate(payload.template_key);
    const version =
      activeTemplate.template_key === payload.template_key ? activeTemplate.version + 1 : 1;

    const insertPayload = {
      active: false,
      content: payload.content,
      name: payload.name,
      template_key: payload.template_key || DEFAULT_AGREEMENT_TEMPLATE_KEY,
      updated_by: adminActorFromRequest(req),
      version,
    };

    const { data, error } = await db
      .from('agreement_templates')
      .insert([insertPayload])
      .select('id, template_key, name, content, version, active, updated_by, created_at, updated_at')
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    console.error('Create agreement template error:', error);
    res.status(500).json({ error: 'Failed to create agreement template' });
  }
});

router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsedParams.error.issues });
    }

    const payload = updateAgreementTemplateSchema.parse(req.body ?? {});
    const current = await fetchAgreementTemplateById(parsedParams.data.id);
    if (!current || current.id === 0) {
      return res.status(404).json({ error: 'Agreement template not found' });
    }

    if (current.active) {
      const { error: deactivateError } = await db
        .from('agreement_templates')
        .update({ active: false })
        .eq('template_key', current.template_key);

      if (deactivateError) throw deactivateError;
    }

    const insertPayload = {
      active: current.active,
      content: payload.content,
      name: payload.name ?? current.name,
      template_key: current.template_key,
      updated_by: adminActorFromRequest(req),
      version: current.version + 1,
    };

    const { data, error } = await db
      .from('agreement_templates')
      .insert([insertPayload])
      .select('id, template_key, name, content, version, active, updated_by, created_at, updated_at')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    console.error('Update agreement template error:', error);
    res.status(500).json({ error: 'Failed to update agreement template' });
  }
});

router.post('/:id/activate', authenticateAdmin, async (req, res) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsedParams.error.issues });
    }

    const template = await fetchAgreementTemplateById(parsedParams.data.id);
    if (!template || template.id === 0) {
      return res.status(404).json({ error: 'Agreement template not found' });
    }

    const { error: deactivateError } = await db
      .from('agreement_templates')
      .update({ active: false })
      .eq('template_key', template.template_key);

    if (deactivateError) throw deactivateError;

    const { data, error } = await db
      .from('agreement_templates')
      .update({
        active: true,
        updated_by: adminActorFromRequest(req),
        updated_at: new Date().toISOString(),
      })
      .eq('id', template.id)
      .select('id, template_key, name, content, version, active, updated_by, created_at, updated_at')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Activate agreement template error:', error);
    res.status(500).json({ error: 'Failed to activate agreement template' });
  }
});

router.post('/:id/preview', authenticateAdmin, async (req, res) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsedParams.error.issues });
    }

    const template = await fetchAgreementTemplateById(parsedParams.data.id);
    if (!template) {
      return res.status(404).json({ error: 'Agreement template not found' });
    }

    const { content, ...payload } = previewAgreementTemplateSchema.parse(req.body ?? {});
    res.json({
      agreement: renderCarLeaseAgreementTemplate(content || template.content, payload),
      agreementTemplateVersion: template.version,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    console.error('Preview agreement template error:', error);
    res.status(500).json({ error: 'Failed to preview agreement template' });
  }
});

router.post('/:id/pdf', authenticateAdmin, async (req, res) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsedParams.error.issues });
    }

    const template = await fetchAgreementTemplateById(parsedParams.data.id);
    if (!template) {
      return res.status(404).json({ error: 'Agreement template not found' });
    }

    const payload = leaseAgreementSchema.parse(req.body ?? {});
    const pdfBytes = await buildCarLeaseAgreementPdf(payload);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="gala-rentals-fillable-lease-agreement.pdf"');
    res.setHeader('X-Agreement-Template-Version', String(template.version));
    res.send(pdfBytes);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    console.error('Generate agreement PDF error:', error);
    res.status(500).json({ error: 'Failed to generate agreement PDF' });
  }
});

router.post('/:id/pdf-jobs', authenticateAdmin, async (req, res) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsedParams.error.issues });
    }

    const template = await fetchAgreementTemplateById(parsedParams.data.id);
    if (!template) {
      return res.status(404).json({ error: 'Agreement template not found' });
    }

    const payload = leaseAgreementSchema.parse(req.body ?? {});
    const job = await createAgreementPdfJob(parsedParams.data.id, payload);
    res.status(202).json({
      id: job.id,
      status: job.status,
      status_url: `/api/admin/document-pdf-jobs/${job.id}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }

    console.error('Create agreement PDF job error:', error);
    res.status(500).json({ error: 'Failed to create agreement PDF job' });
  }
});

export default router;
