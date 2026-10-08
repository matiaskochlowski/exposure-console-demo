# Testing

| Layer         | Tool               | Where                                                | What belongs there                                                                                  |
| ------------- | ------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Contracts     | Vitest             | `src/shared/*.test.ts`, `api/_lib/*.test.ts`         | Schemas, risk score, redaction, injection heuristic, SSE framing, prompt construction, API boundary |
| Logic         | Vitest             | `src/actions`, `src/ai`, `src/features/**/x.test.ts` | Executor transitions, providers (abort, timeout, truncation, fallback), selectors, CSV escaping     |
| Components    | Vitest + RTL       | `*.test.tsx`                                         | Rendering of untrusted content, interactive behaviour by role                                       |
| Flows         | Playwright         | `e2e/*.spec.ts`                                      | Queue, URL state, keyboard path, analyst approve/edit/reject, injection, reset                      |
| Accessibility | axe via Playwright | `e2e/a11y.spec.ts`                                   | Named UI states × light/dark × desktop/mobile                                                       |
| Performance   | Playwright + CDP   | `e2e/perf.spec.ts`                                   | Filter-to-render under 4× CPU throttle (budget in `perf.md`)                                        |
| Agent hooks   | `node --test`      | `.claude/hooks/*.test.mjs`                           | Secret guard, format/lint planning, Stop-hook loop guard                                            |

Rules:

- Query by role and accessible name. Test ids only where no role exists (`proposal`, `scanner-output`).
- The mock analyst is deterministic; E2E may rely on stable markers (e.g. “is P1”), not exact prose.
- E2E picks findings by property from the same seeded generator (`e2e/fixtures.ts`), never hardcoded ids.
- Each test starts from a clean state (`freshPage` clears storage once per test).
- Live-model behaviour is tested with a fake stream factory (`api/_lib/claude.test.ts`); real-model smoke
  tests are manual and never part of credential-free CI.
- Definition of done: `npm run check` and the Playwright suite pass; new UI states have an axe scan.
