import express from 'express';
import { db } from '../db/index.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { renderCarLeaseAgreement } from '../templates/carLeaseAgreement.js';
import { leaseAgreementSchema, createLeaseAgreementSchema } from '../validation.js';
import { z } from 'zod';
import { getApplicationSelectColumns, getCarSelectColumns } from '../schemaCompat.js';

const router = express.Router();

type LeaseAgreementRecord = {
  application_id: string;
  car_id: number;
  content: string;
  created_at: string;
  id: number;
  status: string;
};

const enrichLeaseAgreements = async (
  agreements: LeaseAgreementRecord[]
) => {
  const applicationIds = Array.from(
    new Set(
      agreements
        .map((agreement) => agreement.application_id)
        .filter((id) => id.length > 0)
    )
  );
  const carIds = Array.from(
    new Set(
      agreements
        .map((agreement) => Number(agreement.car_id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  const [applicationsResult, carsResult] = await Promise.all([
    applicationIds.length > 0
      ? db.from('applications').select('id, name').in('id', applicationIds)
      : Promise.resolve({ data: [], error: null }),
    carIds.length > 0
      ? db.from('cars').select('id, name').in('id', carIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (applicationsResult.error) {
    throw applicationsResult.error;
  }

  if (carsResult.error) {
    throw carsResult.error;
  }

  const applicationNames = new Map<string, string>();
  for (const application of applicationsResult.data || []) {
    applicationNames.set(String(application.id), String(application.name || ''));
  }

  const carNames = new Map<number, string>();
  for (const car of carsResult.data || []) {
    carNames.set(Number(car.id), String(car.name || ''));
  }

  return agreements.map((agreement) => ({
    ...agreement,
    applicant_name: applicationNames.get(agreement.application_id) || undefined,
    car_name: carNames.get(Number(agreement.car_id)) || undefined,
  }));
};

router.get('/car-lease/template', authenticateAdmin, (_req, res) => {
  const template = renderCarLeaseAgreement();
  res.type('text/markdown').send(template);
});

router.post('/car-lease/render', authenticateAdmin, async (req, res) => {
  try {
    const payload = leaseAgreementSchema.parse(req.body ?? {});
    const rendered = renderCarLeaseAgreement(payload);
    res.json({ agreement: rendered });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('Render agreement error:', error);
    res.status(500).json({ error: 'Failed to render agreement' });
  }
});

router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const data = createLeaseAgreementSchema.parse(req.body);
    const [applicationSelectColumns, carSelectColumns] = await Promise.all([
      getApplicationSelectColumns(),
      getCarSelectColumns(),
    ]);
    const [{ data: application, error: applicationError }, { data: car, error: carError }] =
      await Promise.all([
        db.from('applications').select(applicationSelectColumns).eq('id', data.application_id).single(),
        db.from('cars').select(carSelectColumns).eq('id', data.car_id).single(),
      ]);

    if (applicationError || !application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (carError || !car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const applicationRecord = application as unknown as Record<string, unknown>;

    if (String(applicationRecord.status) !== 'Paid') {
      return res.status(409).json({
        error: 'Lease agreements can only be created after driver payment is completed.',
      });
    }

    const { data: inserted, error } = await db.from('lease_agreements').insert([data]).select('id').single();

    if (error) throw error;
    res.status(201).json({ id: String(inserted.id) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    console.error('Lease agreement creation error:', err);
    res.status(500).json({ error: 'Failed to save lease agreement' });
  }
});

router.get('/', authenticateAdmin, async (_req, res) => {
  try {
    const { data, error } = await db
      .from('lease_agreements')
      .select('id, application_id, car_id, content, status, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(
      await enrichLeaseAgreements((data || []) as LeaseAgreementRecord[])
    );
  } catch (error) {
    console.error('Fetch lease agreements error:', error);
    res.status(500).json({ error: 'Failed to fetch lease agreements' });
  }
});

router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const parsedParams = z
      .object({ id: z.coerce.number().int().positive() })
      .safeParse(req.params);

    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsedParams.error.issues });
    }

    const { data, error } = await db
      .from('lease_agreements')
      .select('id, application_id, car_id, content, status, created_at')
      .eq('id', parsedParams.data.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Lease agreement not found' });
    }

    const [agreement] = await enrichLeaseAgreements([
      data as LeaseAgreementRecord,
    ]);
    res.json(agreement);
  } catch (error) {
    console.error('Fetch lease agreement error:', error);
    res.status(500).json({ error: 'Failed to fetch lease agreement' });
  }
});

router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const parsedParams = z
      .object({ id: z.coerce.number().int().positive() })
      .safeParse(req.params);

    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsedParams.error.issues });
    }

    const { error } = await db.from('lease_agreements').delete().eq('id', parsedParams.data.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Lease agreement deletion error:', error);
    res.status(500).json({ error: 'Failed to delete lease agreement' });
  }
});

export default router;
