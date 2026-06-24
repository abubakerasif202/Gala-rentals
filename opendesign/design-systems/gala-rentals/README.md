# Gala Rentals Design System

Reusable UI system draft for the Gala Rentals public website and rental operations admin console.

## Sources Consulted

- `src/index.css`
- `src/pages/Home.tsx`
- `src/pages/Apply.tsx`
- `src/pages/Checkout.tsx`
- `src/pages/MyRental.tsx`
- `src/pages/AdminDashboard.tsx`
- `src/components/Navbar.tsx`
- `src/components/Footer.tsx`
- `src/components/admin/Sidebar.tsx`
- `src/components/admin/DataTable.tsx`
- `src/components/admin/MetricCard.tsx`
- `src/components/admin/DetailCard.tsx`
- `src/components/admin/tabs/OverviewTab.tsx`
- `src/components/admin/tabs/ApplicationsTab.tsx`
- Gala workflow rules from repo instructions and memory: admin review before payment, checkout is payment-only, and approved rental details remain manually reviewed.

## Brand Summary

Gala Rentals is a premium Sydney rental application platform with a SaaS-style operations layer. The current brand language is dark navy, warm gold, white/silver public surfaces, generic rental-service imagery, high letter spacing, rounded panels, and precise operational copy.

The design should feel:

- Premium, trust-led, and Australian.
- Clear and conversion-focused on public pages.
- Dense, fast, and auditable inside admin.
- Secure around payments, documents, and customer data.

## Folder Index

- `tokens/colors_and_type.css` contains canonical color, type, radius, shadow, and motion tokens.
- `brand/voice-and-tone.md` documents copy voice and workflow language.
- `brand/style-notes.md` documents visual and interaction rules.
- `assets/` contains copied Gala logos and legacy imagery used by older prototypes; current public UI should use generic rental-service imagery.
- `ui-kit-product/index.html` previews core UI elements.

## Canonical Workflow Language

Use this sequence in product copy and UI labels:

1. Customer applies.
2. Admin reviews documents and driver details.
3. Admin approves rental details, bond, weekly price, and start date.
4. Admin sends a secure Stripe checkout link.
5. Stripe checkout marks the application `Paid`.
6. Admin handles agreements, notices, operational follow-up, and handover.

Avoid implying automatic rental activation after checkout.
