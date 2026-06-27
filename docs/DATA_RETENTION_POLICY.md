# Application data retention scaffold

`api/applicationRetentionPolicy.ts` defines a dry-run-only policy hook for rejected, cancelled, and expired applications. It does not delete records or documents and it excludes paid and payment-review applications.

Current review defaults are 90 days for rejected applications, 90 days for cancelled applications, and 30 days after the intended start date for stale pending/approved applications. These values are operational placeholders and require legal/business approval before enforcement.

Any future deletion workflow must:

- remain admin-only and confirmation-gated;
- generate a dry-run report first;
- write an audit event for every affected application;
- delete private storage documents and verify the result;
- reconcile Stripe/payment records and statutory recordkeeping requirements;
- preserve records subject to disputes, chargebacks, legal holds, or financial retention obligations.

Automatic deletion is explicitly disabled. Enabling enforcement requires a separately reviewed implementation and production approval.
