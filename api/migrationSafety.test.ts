import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('migration safety guards', () => {
  it('keeps the local destructive reset migration skipped by default', () => {
    const resetMigration = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/00_reset.sql'),
      'utf8'
    );

    expect(resetMigration).toContain('app.allow_destructive_local_reset');
    expect(resetMigration).toContain('RAISE NOTICE');
    expect(resetMigration).toContain('RETURN;');
    expect(resetMigration).toContain('DROP TABLE IF EXISTS');
  });

  it('keeps public application inserts routed through the Express backend only', () => {
    const hardeningMigration = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'supabase/migrations/20260623090000_manual_application_vehicle_and_security_hardening.sql'
      ),
      'utf8'
    );

    expect(hardeningMigration).toContain(
      'DROP POLICY IF EXISTS public_submit_application ON public.applications'
    );
    expect(hardeningMigration).toContain(
      'REVOKE INSERT ON TABLE public.applications FROM anon'
    );
  });

  it('prevents car deletes from cascading into historical rental and booking rows', () => {
    const hardeningMigration = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'supabase/migrations/20260623090000_manual_application_vehicle_and_security_hardening.sql'
      ),
      'utf8'
    );

    expect(hardeningMigration).toContain('rentals_car_id_fkey');
    expect(hardeningMigration).toContain(
      'FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE RESTRICT'
    );
    expect(hardeningMigration).toContain('bookings_car_id_fkey');
    expect(hardeningMigration).toContain('lease_agreements_car_id_fkey');
    expect(hardeningMigration).toContain(
      'FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE SET NULL'
    );
  });
});
