import express from 'express';
import { db } from '../db/index.js';
import { authenticateAdmin } from './auth.js';
import { carSchema } from '../validation.js';
import { z } from 'zod';
import {
  getApplicationAssignedCarColumn,
  getBookingCarIdColumn,
  getCarCreatedAtColumn,
  getCarSelectColumns,
  getLeaseAgreementCarIdColumn,
  getRentalCarIdColumn,
  toCarWritePayload,
} from '../schemaCompat.js';

const router = express.Router();

const fetchCarById = async (id: string) => {
  const selectColumns = await getCarSelectColumns();
  const { data, error } = await db.from('cars').select(selectColumns).eq('id', id).single();

  if (error || !data) {
    return null;
  }

  return data;
};

const countRowsForCar = async (table: string, column: string, id: string) => {
  const { count, error } = await db
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, id);

  if (error) {
    throw error;
  }

  return count || 0;
};

router.get('/', async (_req, res) => {
  const selectColumns = await getCarSelectColumns();
  const orderColumn = await getCarCreatedAtColumn();
  const { data, error } = await db
    .from('cars')
    .select(selectColumns)
    .order(orderColumn, { ascending: false });
  if (error) {
    console.error('Fetch cars error', error);
    return res.status(500).json({ error: 'Failed to fetch cars' });
  }
  res.json(data || []);
});

router.get('/:id', async (req, res) => {
  const data = await fetchCarById(req.params.id);

  if (!data) {
    return res.status(404).json({ error: 'Car not found' });
  }
  res.json(data);
});

router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const data = carSchema.parse(req.body);
    const payload = await toCarWritePayload(data);
    const { data: inserted, error } = await db.from('cars').insert([payload]).select('id').single();

    if (error) throw error;
    res.status(201).json({ id: String(inserted.id) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    console.error('Car creation error:', err);
    res.status(500).json({ error: 'Failed to create car' });
  }
});

router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const existingCar = await fetchCarById(req.params.id);
    if (!existingCar) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const data = carSchema.parse(req.body);
    const payload = await toCarWritePayload(data);
    const { error } = await db.from('cars').update(payload).eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues });
    }
    console.error('Car update error:', err);
    res.status(500).json({ error: 'Failed to update car' });
  }
});

router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const existingCar = await fetchCarById(req.params.id);
    if (!existingCar) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const [rentalCarIdColumn, bookingCarIdColumn, leaseAgreementCarIdColumn, applicationAssignedCarColumn] =
      await Promise.all([
        getRentalCarIdColumn(),
        getBookingCarIdColumn(),
        getLeaseAgreementCarIdColumn(),
        getApplicationAssignedCarColumn(),
      ]);

    const [activeRentalCount, bookingCount, leaseAgreementCount, assignedApplicationCount] =
      await Promise.all([
        countRowsForCar('rentals', rentalCarIdColumn, req.params.id),
        countRowsForCar('bookings', bookingCarIdColumn, req.params.id),
        countRowsForCar('lease_agreements', leaseAgreementCarIdColumn, req.params.id),
        countRowsForCar('applications', applicationAssignedCarColumn, req.params.id),
      ]);

    if (
      activeRentalCount > 0 ||
      bookingCount > 0 ||
      leaseAgreementCount > 0 ||
      assignedApplicationCount > 0
    ) {
      return res.status(409).json({
        error:
          'This vehicle is still referenced by rentals, bookings, agreements, or assigned applications. Remove those links before deleting the car.',
        usage: {
          assigned_applications: assignedApplicationCount,
          bookings: bookingCount,
          lease_agreements: leaseAgreementCount,
          rentals: activeRentalCount,
        },
      });
    }

    const { error } = await db.from('cars').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Car deletion error:', error);
    res.status(500).json({ error: 'Failed to delete car' });
  }
});

export default router;
