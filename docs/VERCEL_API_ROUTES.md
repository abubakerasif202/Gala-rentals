# GalaRentals API route inventory

Existing Express registrations are retained. Middleware authorizes each original route; new upload-intent routes use existing admin protection or public submission rate limits.

| Source | Route declarations |
| --- | --- |
| `api/routes/adminAgreements.ts` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `POST /:id/activate`, `POST /:id/preview`, `POST /:id/pdf` |
| `api/routes/adminMaintenance.ts` | `GET /imported-data-reset/dry-run`, `POST /imported-data-reset`, `GET /imported-data-reset/export`, `GET /reset-imported-data/export`, `POST /reset-imported-data/dry-run`, `POST /reset-imported-data` |
| `api/routes/agreements.ts` | `GET /car-lease/template`, `POST /car-lease/render`, `POST /`, `GET /`, `GET /:id`, `DELETE /:id` |
| `api/routes/applications.ts` | `GET /agreement-template`, `GET /`, `GET /:id/documents/:document`, `POST /upload-intent`, `POST /`, `POST /:id/approve-payment`, `POST /:id/retry-payment-activation`, `POST /:id/cancel`, `PUT /:id/status` |
| `api/routes/auth.ts` | `POST /login`, `POST /logout`, `GET /verify` |
| `api/routes/cars.ts` | `POST /admin/sync`, `GET /`, `GET /public`, `GET /admin/all`, `POST /image/upload-intent`, `POST /image`, `DELETE /image`, `GET /:id`, `POST /`, `PUT /:id`, `PATCH /:id/archive`, `DELETE /:id` |
| `api/routes/cron.ts` | `GET /maintenance` |
| `api/routes/customers.ts` | `GET /` |
| `api/routes/financials.ts` | `GET /weekly`, `GET /stats` |
| `api/routes/indexNowAdmin.ts` | `POST /test-indexnow` |
| `api/routes/inquiries.ts` | `POST /` |
| `api/routes/invoices.ts` | `GET /` |
| `api/routes/manualInvoices.ts` | `GET /`, `POST /`, `GET /:id`, `GET /:id/pdf` |
| `api/routes/rentals.ts` | `GET /`, `POST /:rentalId/cancel-subscription` |
| `api/routes/stripe.ts` | `GET /rental-plans`, `GET /lease-settings`, `GET /payment-context`, `POST /vehicle-checkout-session`, `POST /vehicle-checkout-link`, `GET /checkout-sessions/:sessionId` |
| `api/routes/tollNotices.ts` | `GET /company-defaults`, `GET /rental-options`, `GET /`, `POST /`, `GET /:id/pdf`, `POST /:id/send`, `PATCH /:id/status` |
| `api/routes/webhooks.ts` | `POST /` |
