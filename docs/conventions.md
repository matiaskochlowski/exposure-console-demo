# Conventions

## Code

- TypeScript strict with `noUncheckedIndexedAccess`; no `any`. Relative imports use explicit `.js`
  extensions (`./risk.js` for `risk.ts`): Vercel compiles `api/` and `src/shared/` file by file to
  Node ESM, which needs real `.js` specifiers; Vite, Vitest, tsx and Playwright map them back to `.ts`.
- `src/shared/` stays framework-free and side-effect-free so the server can import it.
- Validate at boundaries with Zod (`fetch` results, URL params, request bodies, model tool calls), then
  trust the types inside.
- Pure logic in plain functions with tests; components stay thin.
- Names: components `PascalCase.tsx`, hooks `useThing.ts`, everything else `camelCase.ts`.
- Comments explain _why_ (constraints, trade-offs, bugs found), not _what_.

## State

- Server-ish data: loaded once (`loadDataset`), suspended on with React 19 `use()`.
- Shareable UI state (filters, sort, open finding) lives in the URL.
- Approved actions/proposals: `actionsStore` (external store + `useSyncExternalStore`), persisted.
- Everything else: local component state. No global store library — not needed at this size.

## Accessibility

- Native elements first: `<button>`, `<table>`, `<dialog>`, `<label>`, `<fieldset>`.
- Every control has an accessible name; icon-only buttons get `aria-label`.
- Async updates are announced with a polite `role="status"` region — once per settled result, not per
  keystroke or token.
- Overlays: focus moves in, Escape closes, focus returns to the trigger.
- Colour is never the only signal (priority badges always show `P1`…`P4`).
- `prefers-reduced-motion` is honoured globally in `src/index.css`.

## Styling

- Tailwind utilities generated from the tokens in `src/index.css` (`bg-surface`, `text-muted`,
  `border-line`, `bg-p1-soft`…). Both themes are defined there; components never branch on theme.
- Mobile first; verify at 360 / 768 / 1280 px.

## Git

- Small branches per change; PRs use `.github/pull_request_template.md`.
- Commit messages: imperative subject, body explains why.
