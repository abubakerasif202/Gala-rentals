# Financial Dashboard Handoff

The Admin -> Financials tab is an operational monitoring dashboard for weekly rental revenue and Stripe payout activity. It is not a month-end accounting close report.

## Source

The dashboard reads from:

```text
GET /api/financials/weekly
```

The frontend renders the returned values and derives only display-only comparisons such as margin and payout gap. It does not create rental, payment, or payout records.

## Metrics

- **Projected Gross**: Sum of `weekly_price` for real rentals where `rentals.status = 'Active'`. Imported or legacy application-linked rentals are excluded by the backend filters.
- **Platform Fees**: Active real rental count multiplied by the configured weekly account management fee.
- **Projected Net**: `Projected Gross - Platform Fees`.
- **Recent Payouts**: Stripe payouts in the selected date range where status is `paid` or `in_transit`.
- **Payout Gap**: `Projected Net - Recent Payouts`. Use this as a monitoring signal only; it is not a final accounting variance.
- **Payout Status Mix**: Count of Stripe payout records returned by status for the selected date range.

## Filters

- **Date range** controls the payout date window sent to `/api/financials/weekly`.
- **Payout status** filters the payout trend and payout table for investigation. KPI cards continue to show the backend headline metrics so cards reconcile with the API response.

## Reconciliation

If dashboard numbers do not reconcile:

1. Confirm `/api/financials/weekly` returns the expected `projected_gross_weekly`, `projected_net_weekly`, `estimated_platform_fees`, `actual_payouts_weekly`, and `recent_payouts`.
2. Confirm active rentals in Supabase have the expected `weekly_price` and `status = 'Active'`.
3. Confirm imported or legacy records are not being counted as real rentals.
4. Confirm `STRIPE_SECRET_KEY` is configured in the environment where payout data should load.
5. Compare Stripe payout statuses and arrival dates in the Stripe Dashboard for the selected range.

For accounting close, reconcile Stripe payouts against Stripe balance transactions, invoices, and accounting exports before treating the payout gap as final.

## Operational Notes

- Payment completion, rental activation, and Stripe webhook workflows are not changed by this dashboard.
- Future deeper reporting should connect a real warehouse or semantic layer for source-of-truth business data.
