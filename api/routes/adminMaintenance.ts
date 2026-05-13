import express from 'express';
import { db } from '../db/index.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { z } from 'zod';

const router = express.Router();

const CONFIRMATION_PHRASE = "RESET OLD APPLICANTS";

const resetRequestSchema = z.object({
  confirm: z.string(),
  dryRun: z.boolean().optional().default(false),
});

router.post('/reset-old-applicants', authenticateAdmin, async (req, res) => {
  const parsed = resetRequestSchema.safeParse(req.body);
  
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
  }

  const { confirm, dryRun } = parsed.data;

  if (confirm !== CONFIRMATION_PHRASE) {
    return res.status(400).json({ 
      error: 'Invalid confirmation phrase', 
      message: `You must type "${CONFIRMATION_PHRASE}" to confirm.` 
    });
  }

  try {
    // 1. Identify applications to delete
    // Criteria: legacy_id is not null OR experience contains "Imported"
    const { data: appsToDelete, error: fetchError } = await db
      .from('applications')
      .select('id')
      .or(`legacy_id.not.is.null,experience.ilike.%Imported%`);

    if (fetchError) throw fetchError;

    const appIds = appsToDelete?.map(a => a.id) || [];
    
    // 2. Count associated rentals
    // Note: rentals table has application_id as foreign key with ON DELETE CASCADE
    // but we want to report how many would be deleted.
    const { count: rentalCount, error: rentalCountError } = await db
      .from('rentals')
      .select('*', { count: 'exact', head: true })
      .in('application_id', appIds);

    if (rentalCountError) throw rentalCountError;

    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        applicationsMatched: appIds.length,
        rentalsMatched: rentalCount || 0,
        message: `Found ${appIds.length} old applications and ${rentalCount || 0} associated rentals.`
      });
    }

    if (appIds.length === 0) {
      return res.json({
        success: true,
        deletedApplications: 0,
        deletedRentals: 0,
        message: "No old applicant data found to reset."
      });
    }

    // 3. Perform deletion
    // Since ON DELETE CASCADE is set on rentals, bookings, lease_agreements referencing applications(id),
    // deleting from applications will clean up everything.
    const { error: deleteError } = await db
      .from('applications')
      .delete()
      .in('id', appIds);

    if (deleteError) throw deleteError;

    // 4. Count preserved records for the summary
    const { count: preservedCars } = await db
      .from('cars')
      .select('*', { count: 'exact', head: true });

    res.json({
      success: true,
      deletedApplications: appIds.length,
      deletedRentals: rentalCount || 0,
      preservedCars: preservedCars || 0,
      message: "Old applicant data reset completed successfully."
    });

  } catch (error) {
    console.error('Reset old applicants error:', error);
    res.status(500).json({ error: 'Failed to reset old applicant data' });
  }
});

export default router;
