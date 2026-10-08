---
name: write-tests
description: Write or extend unit (Vitest + React Testing Library) and E2E (Playwright + axe) tests following docs/testing.md. Use after implementing behaviour, when fixing a bug (regression test first), or when coverage of a contract is missing.
---

# Write tests

Follow `docs/testing.md`. Short version:

- **Pure logic** (`src/shared`, `src/actions`, `src/ai`) → plain Vitest, table-driven with
  `it.each`. Cover the contract edges: invalid input, boundaries, idempotency, aborts.
- **Components** → RTL. Query by role and accessible name (`getByRole('button', { name: /approve/i })`),
  never by class or test id unless nothing else is possible. Use `userEvent`, not `fireEvent`.
- **Flows across screens** → Playwright in `e2e/`, against the production build (`npm run build &&
npm run preview`). Add an axe scan (`expectNoA11yViolations(page, 'state name')`) for every new UI
  state you introduce.
- **Bug fix** → write the failing test first, show it failing, then fix.
- Never assert on mock-provider wording beyond stable markers; scripts may change.

Run `npm test` (unit) and `npx playwright test` (E2E). Report what is covered and what is not.
