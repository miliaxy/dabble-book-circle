# Dabble Book Circle product and interface design

Last updated: 19 August 2026

This is the living design source of truth for Dabble Book Circle. It records the current intended product, routes, page responsibilities, interaction rules, and visual system. Update the relevant section whenever the experience changes.

## Product definition

Dabble Book Circle is an invite-only, parent-managed way for trusted Gurgaon families to lend and borrow children's books. It is part of the Dabble product family but has a separate private-data boundary from the public activities directory.

The first pilot is one school-connected Gurgaon circle. The model must later support:

- multiple circles per family;
- school, apartment-complex, neighbourhood, and locality circles;
- one physical book listed in more than one circle without allowing simultaneous loans; and
- growth beyond Gurgaon without redesigning the core lending workflow.

Parents manage accounts, books, requests, handovers, and returns. There are no child accounts or child profiles.

## Experience principles

1. **Trusted before broad.** Books and family identities are visible only inside approved, invite-only circles.
2. **Easy enough for a phone.** Primary actions must work comfortably from a parent's phone with clear touch targets and minimal typing.
3. **Photo or ISBN first.** A parent can photograph a cover or enter an ISBN; the system suggests metadata, including explicit series information when available, and the parent confirms it.
4. **Clear ownership and accountability.** Every request, handover, receipt, due date, return, and confirmation has an explicit state and timestamp.
5. **Family-level identity.** Reliability belongs to the family household, never to a child.
6. **Privacy at the point of need.** Contact details appear only to matched families during an active handover or loan.
7. **Current truth over decorative metrics.** Counts must always be backed by inspectable records.

## Information architecture

The application currently builds under `/books/`. Its eventual Dabblenow production path is a launch-routing decision; the codebase remains independently deployable.

### Public routes

| Route | Purpose |
| --- | --- |
| `/` | Book Circle introduction and primary join action |
| `/how-it-works` | Detailed borrowing mechanics and trust rules |
| `/contact` | Book Circle support contact |
| `/join` | Email-bound invitation redemption |
| `/sign-in` | Returning-parent one-time-code sign-in |

### Signed-in routes

| Route | Purpose |
| --- | --- |
| `/library` | Browse and filter books available within the active circle |
| `/my-books` | Add books, control lending availability, review queues, and manage active lending |
| `/loans` | View the family's waiting, active, and completed borrowing records |
| `/account` | View the family reliability record and manage contact/reminder preferences |
| `/admin` | Admin-only invitations, access requests, circle metrics, and all-family management |

## Shared shell

- Use the same `dabble | Book Circle` lockup across public, signed-in, desktop, and mobile layouts.
- `Pilot` appears as a small bold superscript on the product lockup.
- Desktop signed-in navigation uses a left sidebar; mobile uses a fixed bottom navigation bar.
- Sign out stays visible at the top right of signed-in pages.
- Every route uses the shared dark-grey footer with “Made with Dabble,” How it works, Contact us, and the Gurgaon activities link.
- The active circle name and family count appear once in the signed-in navigation context, avoiding repeated headings.

## Visual system

The interface shares Dabble's friendly, optimistic visual language while giving Book Circle a teal-led identity.

### Typography

- **Nunito:** logo, headings, prominent metrics, and friendly display copy.
- **DM Sans:** body copy, controls, labels, tables, and supporting text.

### Core colours

- Teal (`#2db5a0`) is the primary Book Circle action and trust colour.
- Peach (`#ff8f6b`) connects the product to the broader Dabble identity.
- Purple, blue, amber, green, and pink support status differentiation and the multicolour Dabble character.
- Slate (`#3d4f5f`) is the primary text and footer colour.
- White panels, soft borders, and lightly tinted backgrounds keep dense workflows calm.

### Components

- Primary actions use teal pill buttons.
- Secondary actions use white buttons with subtle borders.
- Destructive or declining actions use restrained red styling and require explicit confirmation where appropriate.
- Cards use rounded corners, subtle borders, and light shadows.
- Status is never communicated by colour alone; every status has visible text.
- Empty states explain what is missing and offer a useful next action.

## Page designs

### Home

- Keep the page concise: one hero, one primary “Join Book Circle” action, a book-focused illustration, and three principle cards.
- Explain that a circle is a private community and that one family may later belong to multiple circles.
- Keep detailed mechanics on How it works rather than lengthening the home page.
- Place the Dabble kids' activities cross-promotion in the footer, not in the primary hero navigation.

### How it works

- Explain photo/ISBN listing, borrowing requests and queues, seven-day loans, dual return confirmation, and family-level accountability.
- State that the seven-day clock begins when the borrower confirms receipt.
- Keep privacy and parent-management rules explicit without centring children as account holders.

### Join and sign in

- Joining names the exact circle associated with the invitation.
- Invitations are single-use and bound to one parent email.
- Sign-in and joining are visually related but use distinct copy and codes.
- The preview may display fictional access codes; production must use real passwordless authentication.

### Browse

- Lead with a personalised parent greeting and a compact borrowing-due card when relevant.
- Search supports title, author, series, and topic; filters support age and immediate availability.
- Identical books owned by different families appear as one catalog title card. The card shows the total copy count and how many copies are currently available.
- Exact ISBN is the primary grouping key. When ISBN is absent, normalized title and author provide a conservative preview fallback; production should use a canonical title record reviewed during book entry.
- Book cards show cover, title, author, series name and book number when applicable, age, language, aggregate circulation state, and copy availability.
- Book details show shared title metadata followed by every physical copy’s sharing family, condition, circulation state, and independent queue so the borrower can choose a copy.
- Requests, queues, handovers, loans, returns, and condition accountability remain attached to the selected physical copy.
- A family cannot request its own book, enter the same copy queue twice, or request or borrow multiple copies of the same title at once.

### My Books

- The page manages books the family owns and may lend; it is not a general reading list.
- Summary metrics cover listed books, currently lent books, and waiting requests.
- Filters are: Listed, Available to borrow, Borrowed, and Unavailable.
- Adding a book supports either:
  - a cover photo scanned on-device in English or Hindi, followed by suggested metadata; or
  - a 10- or 13-digit ISBN lookup without requiring a photo.
- Parents can record an optional series name and book number. Metadata may prefill these only when an explicit series marker is available; the parent remains responsible for confirmation or correction.
- The photo remains in the browser during recognition. Parents can correct every suggested field or enter details manually when recognition fails.
- Each book can be made unavailable to new requests while preserving its listing and existing queue.
- Lenders can inspect the ordered queue, accept the first request, or decline any request with a reason shared with the requester.

### Loans

- This page covers only books the signed-in family is requesting or borrowing; lending activity stays under My Books.
- Filters are: All, Waiting, Borrowing, and Completed.
- Waiting records show queue position and allow the family to leave the queue.
- Active records show the current handover/loan step, counterparty, due date, and relevant confirmation action.
- Completed records remain permanently inspectable for dispute resolution. Each record identifies the book and lender and expands to show receipt, due, borrower-return, lender-confirmation, and loan-reference details.
- The completed-loan metric must be derived from or reconciled with these visible records.

### Account

- Lead with the family borrowing record: completed loans, on-time returns, and on-time rate.
- Provide a direct route from the metric to completed loan records.
- Present family identity in one coherent profile section rather than separate boxes for each field.
- WhatsApp sharing and email reminders remain explicit, reversible preferences.

### Admin

- Only circle administrators can access this route.
- Show current-circle identity, approved-family count, listed-book count, active-loan count, and pending-access count.
- Access requests require review; approval creates a family membership, and decline requires a reason.
- Invitations are single-use, email-bound, expiring, copyable, and revocable.
- Display all approved families—not an unexplained recent subset—and provide search by family, parent, or email.
- Suspending a family changes circle access without deleting historical loan evidence.

### Contact

- Provide one clear Book Circle support channel for access, book, handover, return, or privacy issues.
- Do not expose private family contact details on this page.

## Lending state model

```text
Waiting request
  → Lender accepts
  → Handover ready
  → Lender marks handed over
  → Borrower confirms receipt
  → Seven-day loan active
  → Borrower marks returned
  → Lender confirms return
  → Lender records private condition feedback
  → Completed and retained in history
```

Queue order is first-in, first-out. Only one active loan may exist for a physical book. A returned book does not become available again until the lender confirms receipt.

## Responsive and accessibility requirements

- Design from 320 px wide upward with no horizontal scrolling.
- Primary mobile actions should be at least 44 px high.
- Dialogs become bottom sheets on small screens and remain keyboard accessible.
- Inputs require visible labels, errors use `role="alert"`, and icon-only meaning must have accessible text.
- Keyboard focus must remain visibly outlined.
- Respect reduced-motion preferences.
- Test both desktop and phone layouts for every user-visible change.

## Data and privacy boundaries

- No child accounts, names, profiles, birthdays, classrooms, or direct messaging.
- Source code and previews contain fictional data only.
- Production book photos use private storage and expiring access URLs.
- WhatsApp numbers never appear in the catalog, queues, member list, or public pages.
- Reliability is family-level. Timeliness comes from timestamps; condition feedback and private notes are not public star ratings.
- Book Circle production data belongs in a dedicated private backend, separate from Dabble's public activities directory.

## Current implementation boundary

The deployed pilot remains a fictional frontend preview using browser local storage. The Supabase schema and typed adapter are prepared but not connected to a live project. Real authentication, persistence, notification delivery, administrator data, retention operations, analytics, and production routing require a separate staging and privacy review.

## Documentation and release policy

- This document always describes the current intended experience.
- Every user-visible design or behavior change updates this document in the same commit.
- Unit tests and regression tests document executable behavior.
- Git commits, GitHub issues, and pull requests provide chronological implementation history.
- A standalone `CHANGELOG.md` is not maintained during the pilot. Use GitHub Releases when versioned, parent-facing release notes become useful.
