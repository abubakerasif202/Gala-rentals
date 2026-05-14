# Admin Payments And Manual Invoices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin Stripe subscription cancellation, make bond manual-only, and add admin manual invoice creation/PDF download.

**Architecture:** Keep admin-only operations behind existing `authenticateAdmin`. Reuse the existing Supabase client and admin dashboard tabs. Use `pdfkit` for manual invoice rendering and a small Supabase migration for invoice tables.

**Tech Stack:** Express, Supabase, Stripe SDK, React, TanStack Query, Vitest, pdfkit.

---

### Task 1: Stripe Checkout Bond Removal

**Files:**
- Modify: `api/services/stripeCheckoutService.ts`
- Test: `api/tests/api.test.ts`

- [ ] Write a failing API test proving `/api/stripe/vehicle-checkout-session` creates `mode: "subscription"` with one recurring weekly line item and no bond/setup line items.
- [ ] Run the focused test and confirm it fails because bond/setup are still charged.
- [ ] Change `buildSubscriptionLineItems` to include only `weeklyRental`; keep `approved_bond` in metadata.
- [ ] Run the focused test and confirm it passes.

### Task 2: Admin Subscription Cancellation

**Files:**
- Modify: `api/routes/rentals.ts`
- Modify: `api/index.ts` only if a route mount is needed
- Modify: `src/lib/api.ts`
- Modify: `src/components/admin/tabs/RentalsTab.tsx`
- Modify: `src/pages/AdminDashboard.tsx`
- Test: `api/tests/api.test.ts`

- [ ] Add failing tests for unauthenticated cancellation, bad confirm phrase, rental without subscription, period-end update, immediate cancel, and local rental status changes.
- [ ] Run the focused tests and confirm they fail due to missing route/Stripe behavior.
- [ ] Implement `POST /api/admin/rentals/:rentalId/cancel-subscription` using existing admin auth, Stripe subscription update/cancel, idempotency key, and local rental status update.
- [ ] Add admin UI modal with required `CANCEL SUBSCRIPTION` text and period-end/immediate options.
- [ ] Run focused backend tests and build to confirm types.

### Task 3: Manual Invoice System

**Files:**
- Create: `api/manualInvoices.ts`
- Create: `api/templates/manualInvoicePdf.ts`
- Create: `api/routes/manualInvoices.ts`
- Modify: `api/index.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/types.ts`
- Modify: `src/components/admin/Sidebar.tsx`
- Modify: `src/components/admin/tabs/InvoicesTab.tsx`
- Modify: `src/pages/AdminDashboard.tsx`
- Create: `supabase/migrations/20260514090000_add_manual_invoices.sql`
- Test: `api/tests/api.test.ts`

- [ ] Add failing tests for create, validation rejection, duplicate invoice number, list, detail, and PDF content type/template text.
- [ ] Run focused tests and confirm missing route failures.
- [ ] Implement invoice validation, number generation, total calculation, persistence, and PDF rendering.
- [ ] Add admin invoice form with line items, totals, status selector, create, preview/download actions.
- [ ] Run focused tests, server build, client build, and full validation.
