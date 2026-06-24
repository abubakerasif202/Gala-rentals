# Style Notes

## Color

Dark navy and gold are the core brand signal. Public pages may use white and pale silver as the main surface, but admin should stay dark and operational.

- Gold is for primary action, active navigation, secure/payment emphasis, and important icons.
- Navy is for authority, app chrome, and primary text.
- White panels should be used for public trust, application support cards, and high-readability admin metric cards.
- Red is reserved for destructive or rejected states.

## Typography

The current codebase uses Inter for body text and Playfair Display for premium hero moments. Keep that pairing for continuity. Use a mono accent only for session IDs, document numbers, and audit trail metadata.

## Layout

- Public pages: generous sections, generic rental-service imagery, clear CTA rows, trust panels.
- Application flow: stepper, grouped fields, secure-document language, no surprise payment requests.
- Admin: left navigation, dense data tables, compact search/filter controls, side detail drawer, action rail, timeline.
- Customer status: mobile-first card stack with payment/application state and next actions.

## Components

- Cards: 16-28px radius depending on scale. Avoid colored left-border accent strips.
- Buttons: pill for public CTAs; rounded rectangle for admin actions.
- Badges: small, uppercase, bordered, tinted by status.
- Tables: scroll-safe, sortable, filterable, compact rows, clear action icon buttons.
- Modals/drawers: contain structured detail grids plus explicit action groups.

## Motion

Use subtle entrance and state motion:

- 140ms for hover and press.
- 240ms for tab/screen changes.
- 360ms for detail drawer entry.

Avoid decorative looping animations. Motion should confirm navigation, approval, payment-link generation, and document creation.
