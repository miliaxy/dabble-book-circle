# Pilot privacy model

Dabble Book Circle is a parent-managed lending circle, not a children's social network.

## Data minimization

- Accounts represent authenticated parents and a family household.
- There are no child accounts, child profiles, birth dates, classroom rosters, or child-to-child messages.
- The catalog exposes a family display name, not a child's name.
- Book photos are private objects and are never placed in a public bucket.
- Invitation plaintext is returned once; only its SHA-256 hash remains in the database.
- Lender notes are stored in the non-exposed `private` schema.

## WhatsApp rule

The phone number is stored only on the parent's own profile. It is not copied into families, requests, loans, notifications, catalog results, or audit details.

The matched counterparty can retrieve it only while the loan is in one of these states:

1. handover ready;
2. awaiting borrower receipt;
3. borrowed; or
4. borrower marked returned, awaiting lender confirmation.

The lookup returns `null` if the counterparty disabled sharing or has no number. The setting remains reversible while the pilot family discusses comfort with phone-number sharing.

## Reliability rule

Reliability belongs to the family household, never to a child. Timeliness is calculated from timestamps rather than entered as an opinion. The lender records only the returned book's condition, with an optional private note. Circle members can receive aggregate counts, not a public star rating or a child-level score.

## Operational boundary

Row-level security is the last line of defense, not the only one. Before launch, Dabble still needs reviewed access to the Supabase organization, least-privilege administrator roles, backup and deletion procedures, a retention policy, an incident-response contact, and a clear parent-facing privacy notice.
