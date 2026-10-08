# Exposure Console — agent guide

React SPA (Vite, React 19, TypeScript strict, Tailwind v4) for triaging a synthetic exposure-management
queue, plus a Vercel function (`api/`) for the optional live AI analyst. Read this file first, then the
doc relevant to your task.

## Commands

| Task                             | Command                                                                    |
| -------------------------------- | -------------------------------------------------------------------------- |
| Dev server (mock analyst)        | `npm run dev` → http://localhost:5173                                      |
| Dev with `/api` (live analyst)   | `npm run dev:full` (`vercel dev`, needs `.env.local`)                      |
| Fast check (Stop hook runs this) | `npm run check:fast` — typecheck + unit tests                              |
| Full gate (CI parity)            | `npm run check`                                                            |
| Unit tests                       | `npm test` (Vitest, non-watch)                                             |
| E2E + a11y + perf                | `npm run build && npx playwright test --project=chromium --project=mobile` |
| Hook tests                       | `npm run test:hooks`                                                       |

## Map

- `src/shared/` — pure, framework-free contracts used by **both** browser and server: finding schema,
  risk score, data generator, redaction, injection heuristic, action schemas, stream protocol, request
  schema. Change these first and test them hardest.
- `src/actions/` — human-in-the-loop executor (pure reducer) + persisted store.
- `src/ai/` — assistant providers (mock, HTTP/SSE, live-with-fallback).
- `src/features/` — screens: `queue/`, `finding/` (drawer route), `assistant/` (AI panel).
- `src/ui/` — design-system primitives. Reuse before adding.
- `api/` — Vercel functions; `api/_lib/` is shared server code (underscore = not a route).
- `e2e/` — Playwright specs against the production build.
- `docs/` — conventions, testing, perf budgets, AI security policy, glossary, ADRs, build log.

## Rules

- **Untrusted text** (scanner output, model output, URL params, localStorage) is never rendered as HTML.
  `dangerouslySetInnerHTML` is banned by ESLint. Model markdown goes through `SafeMarkdown`. See ADR 0003.
- **The model proposes, people approve.** Never add a code path that executes an action without
  `actionsStore.approve`. New actions follow the `add-ai-action` skill.
- **Data boundary:** only `buildFindingContext` output reaches a model. Never add hostnames, IPs, owners
  or free text from the client to a prompt. See `docs/security-ai.md`.
- **Secrets:** never read `.env*` files or print env vars (a hook blocks it). Keys live only in Vercel /
  `.env.local`; nothing secret in `VITE_*` variables.
- Tokens, not colours: use the semantic Tailwind utilities from `src/index.css`.
- Accessibility is a requirement: semantic elements first, every control named, keyboard path works.
- Tests: behaviour-level (RTL by role), contract edges in `src/shared`, E2E for flows. Bug fix → failing
  test first.
- Keep the queue fast: no per-row work in render, no new dependency in the initial bundle without
  checking `npm run size` (budget in `docs/perf.md`).

## Workflow

Skills in `.claude/skills/` (wireframe-to-component, write-tests, a11y-audit, perf-pass,
fe-security-review, pr-prep, add-ai-action); read-only reviewers in `.claude/agents/`; `/check` and
`/review-pr` commands. Hooks format/lint each edit, block secret access and run `check:fast` before a
turn ends. Branch → PR (template) → reviewer subagent → CI green → merge.
