# Dabble Book Circle working agreements

These rules apply to every change in this repository.

## Tests are required

- Every code or behavior change must include appropriate unit tests. A bug fix must include a regression test whenever the behavior can be tested automatically.
- Run `pnpm test` after every logical change set, including documentation-only change sets, so a handoff never assumes the existing suite still passes.
- Before committing or handing work back, run all three checks:

  ```bash
  pnpm typecheck
  pnpm test
  pnpm build
  ```

- Do not mark work complete while a required check is failing. If a check cannot run, state the exact blocker.

## Keep the product design current

- [`docs/product-design.md`](docs/product-design.md) is the living source of truth for the product and interface design.
- Update the relevant section in the same commit whenever a change affects a route, page structure, copy, user flow, interaction, visual token, responsive behavior, privacy behavior, or product rule.
- Keep the document focused on the current intended design. Git history—not the design document—preserves superseded versions.

## Change history

- Do not maintain a duplicate chronological `CHANGELOG.md` during the pilot.
- Use descriptive Git commits and GitHub pull requests or issues for implementation history.
- Use GitHub Releases for parent-facing release notes when the product begins versioned releases.
- If a major technical decision needs durable rationale, add a focused architecture decision record under `docs/decisions/` rather than a general changelog.

## Privacy and fixture safety

- Keep all people, schools, contact details, communities, bookshelves, and loan activity in source code fictional.
- Never put production credentials, service-role keys, real invitation codes, or real family information in the repository.
