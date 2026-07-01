import express from 'express';
import { z } from 'zod';
import {
  createManualInvoice,
  getManualInvoiceById,
  listManualInvoices,
  manualInvoiceInputSchema,
} from '../manualInvoices.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { createManualInvoicePdfJob } from '../services/documentPdfJobs.js';
import { renderManualInvoicePdf } from '../templates/manualInvoicePdf.js';

const router = express.Router();

const idParamSchema = z.object({
  id: z.string().trim().min(1),
});

const safePdfFilename = (invoiceNumber: string) =>
  `galarentals-invoice-${invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, '-')}.pdf`;

router.get('/', authenticateAdmin, async (_req, res) => {
  try {
    res.json(await listManualInvoices());
  } catch (error) {
    console.error('Manual invoice list error:', error);
    res.status(500).json({ error: 'Failed to fetch manual invoices' });
  }
});

router.post('/', authenticateAdmin, async (req, res) => {
  const parsed = manualInvoiceInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.issues,
    });
  }

  try {
    const invoice = await createManualInvoice({
      adminEmail: req.admin?.email || null,
      input: parsed.data,
    });

    res.status(201).json(invoice);
  } catch (error) {
    if (error instanceof Error && (error as Error & { status?: number }).status === 409) {
      return res.status(409).json({ error: error.message });
    }

    console.error('Manual invoice create error:', error);
    res.status(500).json({ error: 'Failed to create manual invoice' });
  }
});

router.get('/:id', authenticateAdmin, async (req, res) => {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
  }

  try {
    const invoice = await getManualInvoiceById(parsed.data.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Manual invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Manual invoice detail error:', error);
    res.status(500).json({ error: 'Failed to fetch manual invoice' });
  }
});

router.get('/:id/pdf', authenticateAdmin, async (req, res) => {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
  }

  try {
    const invoice = await getManualInvoiceById(parsed.data.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Manual invoice not found' });
    }

    const pdf = await renderManualInvoicePdf(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${safePdfFilename(invoice.invoice_number)}"`
    );
    res.send(pdf);
  } catch (error) {
    console.error('Manual invoice PDF error:', error);
    res.status(500).json({ error: 'Failed to render manual invoice PDF' });
  }
});

router.post('/:id/pdf-jobs', authenticateAdmin, async (req, res) => {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
  }

  try {
    const invoice = await getManualInvoiceById(parsed.data.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Manual invoice not found' });
    }

    const job = await createManualInvoicePdfJob(parsed.data.id);
    res.status(202).json({
      id: job.id,
      status: job.status,
      status_url: `/api/admin/document-pdf-jobs/${job.id}`,
    });
  } catch (error) {
    console.error('Manual invoice PDF job create error:', error);
    res.status(500).json({ error: 'Failed to create manual invoice PDF job' });
  }
});

export default router;
