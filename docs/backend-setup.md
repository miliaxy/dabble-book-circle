# Private backend setup

The backend files are ready, but no live project is connected. Keep the frontend in `preview` mode until the pilot administrator has reviewed staging.

## Architecture boundary

Use a **new, dedicated Supabase project** for Dabble Book Circle. Do not run these migrations in DabbleNow's public activities project. Book Circle contains parent contact details, private memberships, book photos, requests, loans, and reliability records; it therefore has a different privacy boundary from the public activity directory.

The same family-owned book copy can later be listed in more than one circle. This supports a school circle now and a Gurgaon locality circle later without duplicating the family or book. Queue order and the one-active-loan rule are enforced across the physical copy.

## What is already prepared

The ordered migrations in `supabase/migrations/` create:

- parent profiles and families, with no child account or child-profile table;
- invite-only circles and expiring, single-use, hashed invitation codes;
- canonical book metadata, family-owned copies, and circle listings;
- FIFO requests and one active loan per physical copy;
- receipt-confirmed seven-day due dates and dual return confirmation;
- system-derived timeliness plus lender-provided condition feedback;
- a private notification queue and non-public audit trail;
- a private 5 MB image bucket limited to supported image types; and
- row-level security and narrowly granted database functions.

The browser adapter in `src/backend/` refuses service-role and secret keys. The service-role key must exist only in a future server-side notification or administration process.

## Staging connection checklist

1. Create a new private Supabase project owned by Dabble.
2. Apply the three migrations in filename order, ideally through a reviewed migration workflow. If using the SQL editor, use one clean editor tab per file and stop on any error.
3. In Supabase Auth, configure the staging and production redirect URLs for `/books/library`.
4. Authenticate the first pilot parent, call `bootstrap_parent`, then run a reviewed copy of `supabase/pilot_bootstrap.example.sql` to create the first circle administrator.
5. Put the project URL and **publishable** browser key in local or Netlify environment variables. Never paste either a service-role JWT or an `sb_secret_…` key into a `VITE_` variable.
6. Change `VITE_BOOK_CIRCLE_BACKEND` to `supabase` only in staging.
7. Update the deployed Content Security Policy `connect-src` with the exact Supabase HTTPS and WebSocket origins. The current preview CSP intentionally allows no unknown backend.
8. Run the complete staging acceptance checklist below before adding real families.

Environment variables:

```text
VITE_BOOK_CIRCLE_BACKEND=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

## Invitation posture

In the first pilot, Supabase may create an authenticated parent after a magic-link request, but that account can see no circle or family data until it bootstraps its family and redeems a valid invitation. If Dabble later wants authentication itself—not only circle membership—to be invitation-only, add a server-side invite endpoint or an Auth hook; do not put the admin API or service key in the browser.

## Staging acceptance checklist

- An unauthenticated client cannot read any public table or private photo.
- A parent in Circle A cannot read Circle B's members, catalog, requests, loans, or photos.
- An ordinary member cannot read invitation hashes, private feedback notes, or audit events.
- A borrower sees only their own request identity; the catalog shows only a count and state.
- Two simultaneous requests have deterministic FIFO order.
- Two simultaneous accept attempts produce no more than one active loan for a copy.
- The due date is exactly seven days after borrower receipt, not lender acceptance or handover.
- Return completion requires the borrower action followed by the lender action.
- WhatsApp is null when sharing is disabled and is unavailable outside an active matched loan.
- A book photo link expires and cannot be downloaded by a non-member.
- Removing a family from a circle removes its circle and photo access.
- No child name, school roster, home address, or real pilot contact appears in source or fixtures.

## Deliberately deferred

- live Supabase credentials and schema application;
- email/WhatsApp notification delivery;
- school administrator and dispute-management screens;
- the DabbleNow `/books/*` production proxy and navigation change; and
- production analytics, retention controls, backups, and incident procedures.

These are staging and launch tasks, not safe assumptions for a local foundation.
