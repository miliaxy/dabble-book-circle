# Dabble Book Circle

Dabble Book Circle is the private, parent-managed book-lending product planned for `dabblenow.com/books`. It shares Dabble's visual language while keeping family, membership, book-photo, request, and loan data separate from the public activities directory.

## Current foundation

This repository currently contains the interactive frontend foundation:

- public Book Circle introduction and Dabble Activities cross-promotion;
- invite-only and returning-parent access previews;
- parent and family-level identity only—no child accounts;
- private-circle book browsing, filters, and Goodreads links;
- photo-first English/Hindi cover recognition and ISBN-based metadata lookup;
- fair request queues and lender acceptance;
- handover and borrower receipt confirmation;
- seven-day loans beginning only after confirmed receipt;
- borrower return plus lender return confirmation;
- structured family-level return feedback; and
- optional WhatsApp sharing limited to an active matched handover or loan; and
- a circle-admin preview for email-bound invitations, access requests, and member management.

All included people, communities, contact details, bookshelves, and loan activity are fictional preview data. Do not add real family or school data to source code or fixtures.

## Run locally

Install dependencies and run the development server:

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173/books/`.

Preview access:

- invitation code: `DABBLE-DEMO`
- returning-parent code: `246810`

The preview saves interactions to browser local storage. Use **Reset private preview** in Account to restore the fictional starting state.

The repository also contains a disconnected production-backend foundation:

- ordered private Supabase migrations in `supabase/migrations/`;
- a private book-photo bucket with circle and family access policies;
- database-enforced invitation, queue, loan, return, and feedback operations;
- a typed browser adapter in `src/backend/` that rejects secret keys; and
- setup and privacy reviews in `docs/backend-setup.md` and `docs/privacy-model.md`.

It remains in preview mode and does not contain or connect to a real Supabase project.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

The automated tests cover book lookup, preview-data consistency, queue order, receipt-based due dates, lender-confirmed returns, request declines, invitation reissuing, access approvals, and administrator authorization.

## Project working agreements

- [`AGENTS.md`](AGENTS.md) requires tests for every behavior change and the complete verification suite before handoff.
- [`docs/product-design.md`](docs/product-design.md) is the living source of truth for the current product and interface design and must change with every user-visible update.
- Git and GitHub provide chronological implementation history during the pilot, so the project does not maintain a duplicate `CHANGELOG.md`.

## Production boundary

Local storage and preview codes are not production authentication or persistence. Before inviting real families, connect a separate private Supabase project using the prepared migrations and complete the staging checklist in `docs/backend-setup.md`.

The foundation includes:

- passwordless parent authentication;
- expiring, single-use community invitations;
- family and community membership tables;
- row-level policies for every private table;
- private book-photo storage;
- database-enforced queue and loan transitions;
- a private notification queue ready for a later server-side delivery job; and
- audit data ready for a later administrator path for membership and return issues.

Notification delivery and production administrator data wiring are not yet implemented. The administrator interface currently runs against fictional preview data.

The production site can remain an independent Netlify application and be proxied behind `/books/*` from the existing DabbleNow site. The existing DabbleNow activity site should only receive the navigation/cross-promotion link and routing rule after the private backend and staging review are complete.
