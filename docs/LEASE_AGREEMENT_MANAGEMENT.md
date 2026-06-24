# Lease Agreement Management

This document describes the current Gala Rentals agreement flow. It is aligned to the payment-only application workflow: admin approval and agreement drafting may happen before payment, but saved lease agreements are only persisted after the driver payment is complete.

## Current Contract

- `lease_agreements` stores rendered agreement text for audit history.
- `application_id` is required and links the agreement to the reviewed application.
- `car_id` is nullable. Gala approval uses manually entered vehicle / number plate text, not a required live car assignment.
- `vehicle_label` stores the manual vehicle text used for display and agreement history.
- The API rejects imported legacy applications and only saves agreements for applications whose status is `Paid`.
- Draft rendering is available through the admin UI before payment, but final save is gated until payment is complete.

## Data Shape

Current agreement records use the snake-case shape exposed by the API:

```sql
lease_agreements (
  id bigint primary key,
  application_id uuid not null references applications(id) on delete cascade,
  car_id bigint null references cars(id) on delete set null,
  vehicle_label text null,
  content text not null,
  status text not null default 'generated',
  created_at timestamptz not null default current_timestamp
)
```

Important migration anchors:

- `supabase/migrations/01_schema.sql` creates the base `lease_agreements` table.
- `supabase/migrations/20260326110000_convert_application_and_invoice_ids_to_uuid.sql` converts `application_id` to UUID.
- `supabase/migrations/20260429051052_loosen_lease_agreement_vehicle_reference.sql` adds `vehicle_label` and makes `car_id` nullable.
- `supabase/migrations/20260623090000_manual_application_vehicle_and_security_hardening.sql` keeps `car_id` nullable and uses `ON DELETE SET NULL`.

## API Surface

- `GET /api/agreements/car-lease/template`: returns the active markdown template.
- `POST /api/agreements/car-lease/render`: renders a draft agreement from validated server-side inputs.
- `POST /api/agreements`: saves a paid application's rendered agreement with optional `car_id` and `vehicle_label`.
- `GET /api/agreements`: lists saved agreements with applicant and vehicle-label enrichment.
- `GET /api/agreements/:id`: returns one saved agreement.
- `DELETE /api/agreements/:id`: deletes an agreement and writes an admin audit event.

All routes are admin-protected.

## Operational Notes

- Treat the saved `content` as the historical record. Regenerating later may use a newer template or updated application fields.
- Do not make `car_id` required again unless the business explicitly moves back to real vehicle assignment.
- Preserve long-text and optional-field tolerance in PDF/template rendering.
