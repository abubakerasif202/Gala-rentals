---
name: gala-rentals-design-system
description: Gala Rentals premium rental SaaS design system for public rental pages and dense admin operations.
---

# Gala Rentals Design System

Use this system for Gala Rentals public rental pages, application workflows, admin dashboards, payment review, documents, notices, invoices, rentals, and customer status views.

## Product Rules

- Preserve the application lifecycle: apply, admin review, approve pricing, issue secure Stripe checkout, mark paid, then run operational follow-up manually.
- Checkout completion is payment-only in the current app. Do not imply automatic rental row creation or automatic asset assignment after payment.
- Admin approval uses manually reviewed rental details. Do not design a required live fleet assignment step for payment approval.
- Public pages must not expose admin-only workflows.

## Visual Direction

Gala is a premium Australian rental application platform: dark navy authority, warm gold trust, white public clarity, and operationally dense admin surfaces. The system should feel closer to a financial operations console than a marketplace template.

## Core Patterns

- Public surfaces use white or pale silver shells, generic rental-service imagery, navy CTAs, gold primary actions, and trust-focused copy.
- Admin surfaces use deep navy backgrounds, white or translucent panels, compact tables, status badges, detail drawers, and audit/timeline panels.
- Forms are calm, step-based, and explicit about review before payment.
- Payment screens must show approved rental details, bond, weekly amount, secure Stripe handoff, and post-payment manual onboarding notes.
- Documents and notices use structured panels with history, generation actions, and signed/private document language.

## Components To Prefer

- Status badges for Pending, Approved, Rejected, Payment Review, Paid, Cancelled, Sent, Draft, Open.
- Dense data tables with search, filter, sort, selection, and pagination.
- Detail cards with title, status, field grid, body, footer, and action zone.
- Timeline rows for audit, payment link, checkout, document generation, toll notice, and manual follow-up events.
- CTA buttons with a strong label plus exact outcome.
