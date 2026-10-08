# Build log

This log covers how Release 1 was built with Claude Code (Claude Opus 5.5, Claude Code 2.1.295) in a
single working session on 2026-10-08. It records only what actually happened. Prompts and logs are
paraphrased, and nothing from private workspaces is included.

**Roles.** The human set direction and constraints, chose between options, supplied an independent
plan review, and reviewed the result. Claude planned, wrote the code, tests and docs, ran the tools,
and delegated reviews to subagents. The commit history groups the session's work by layer **after
the fact**, so intermediate commits are not each guaranteed to build. The PR's final state is what CI
checks.

## 1. Plan → independent review → plan v2

- **Plan mode.** Claude read the role requirements and drafted a plan: a CTEM-style console, a
  component library, a mock-first AI analyst with human-in-the-loop, and a Claude Code showcase.
- **Human decisions** (asked as multiple choice):
  - neutral branding (no company names)
  - a mock analyst by default, with an optional real-Claude path
  - Vercel hosting
  - Vite + React 19 + TypeScript
- **Plan review.** A separate review of the plan marked it "conditionally ready" and asked for:
  - an executor contract (what happens _after_ approval)
  - a server-side data boundary
  - full stream and error semantics
  - a timeboxed first release
  - staged CI gates
  - measurable performance and accessibility budgets
  - verifying the hooks rather than just describing them
- **Plan v2.** All of the above were adopted, and the scope was cut to a vertical slice.

## 2. Scaffold and dependency hygiene

- **Pinned stable majors.** The newest majors on npm (TypeScript 7, TanStack Table 9, ESLint 10)
  were deliberately avoided in favour of APIs with known behaviour ([ADR 0001](adr/0001-vite-spa.md)).
- **`npm audit` was not clean on the first install**, so two dependencies were swapped:
  - `@size-limit/preset-app` pulled a puppeteer chain with high-severity advisories. Replaced with
    `@size-limit/file`.
  - Vitest 3 depended on a `tinypool` with a critical advisory. Upgraded to Vitest 4.
- **npm 10 resolver bug.** npm 10's arborist crashed resolving Vitest 4's optional peers. The fix was
  `legacy-peer-deps` with the peers pinned explicitly, documented in `.npmrc`. The install then
  reported **0 vulnerabilities**.

## 3. Contracts first

The `src/shared/` modules were written and tested first: risk score, the deterministic generator,
redaction, the injection heuristic, action schemas, the SSE protocol, and the request/context
builder. These are the pieces the browser and the server must agree on. The parser test feeds the
stream split at **every** byte offset, and the HTTP client test splits inside UTF-8 characters.

## 4. Hooks, written and tested

- **The hooks are Node scripts with their own `node:test` suite.**
- **A test caught the guard blocking `.env.example.bak`.** We decided that blocking is correct: the
  file's content is unknown. So the _test_ was changed, not the hook.

## 5. UI and what the checks caught

- **Lint caught accessibility issues (`jsx-a11y`).**
  - Fixed one real issue: a function export broke fast refresh.
  - Two patterns are deliberate (row key delegation, and backdrop click whose keyboard equivalent
    is Escape). They carry disables with a written justification.
- **The E2E focus-restore test found a real browser bug.** After closing the drawer, the queue
  scrolled to about **2×** the target row. Logging showed `scrollToIndex` landed correctly, and then
  **CSS scroll anchoring** shifted the view again when the top spacer row grew. Fix:
  `overflow-anchor: none` on the scroller, with a comment pointing back to the test.
- **The E2E injection test exposed a bad look.** The injected finding legitimately scored P4 with low
  EPSS, so the mock analyst proposed "accept risk", which is exactly what the injected text asked
  for. New rule: never suggest accepting risk when the evidence looks tampered with. It was later
  enforced in code (§7).
- **Screenshot review caught a mobile layout problem.** On phones the filter bar used half the screen.
  Fixes: search and environment share one row, the chips scroll horizontally, and the header analyst
  badge is hidden. A `w-full`/`w-auto` class conflict was also fixed.

## 6. The live-Claude path

- **The `claude-api` skill was loaded before any SDK code was written.**
- **Model.** The default is `claude-opus-5-5` (configurable with `ANTHROPIC_MODEL`), with
  `effort: low` for chat-length answers. Server-side refusal fallbacks are enabled
  (`fallbacks: "default"`).
- **Tools.** Tool schemas are generated from the same Zod schemas the executor uses, so the two cannot
  drift.
- **Proposals.** These are emitted only from the complete final message, after validation.
- **No credential-dependent tests.** The live path is unit-tested with a fake stream factory, so no
  test needs credentials.

## 7. Reviewer subagents and what changed

The three read-only reviewers (`.claude/agents/`) ran in parallel over the codebase. Each was limited
to Read/Grep/Glob and wrote a report only. Every finding was triaged, and most were fixed with a test.

**a11y-auditor** (10 findings, static review; axe was already passing):

- **Toasts never reached anyone.** They rendered _outside_ the modal drawer, so while it was open
  they were inert and hidden behind it. Fix: outcomes are announced by a status region inside each
  proposal card.
- **Pressed buttons took focus with them.** Edit, Approve, Reject, Clear filters, Clear selection,
  Dismiss and the suggestion buttons all unmounted and dropped focus to `body`. Each now moves focus
  to a sensible target.
- **Escape inside the edit form closed the whole drawer** and lost the draft. It now cancels the edit.
- **Overridden priority was silent for screen readers.** It was marked by an `aria-label` on a plain
  span, which is ignored. It now uses an sr-only "(overridden by a person)".
- **The table had no keyboard help or selection state.** Added an sr-only keyboard instruction and
  ", selected" row text. The focus ring is now drawn on cells, and `scroll-padding` keeps a focused
  row out from under the sticky header.
- **Other announcements:** speaker labels on conversation turns, a selection count, pending proposals
  in the status text, and a loading status for the skeleton and drawer chunk.

**security-reviewer** (10 findings):

- **The secret guard could be bypassed** with shell quoting (`.e''nv.local`), globs (`.env.l*`) or
  `<` redirection, combined with the auto-allowed `git diff:*`. Fixes:
  - the hook now normalises quotes and escapes, catches globs and `process.env`, and fails closed
  - the allow-list was cut to exact `git diff` forms with no wildcard `npx`
  - the docs now state that allowing a test runner allows arbitrary code
- **The "no accept-risk on KEV / tampered evidence" rule was prompt-only.** It is now enforced in code
  in `policyAllows` (server) and in the executor (client), with tests.
- **`/api/assist` was gated only by the presence of a key.** It now needs `LIVE_ANALYST_ENABLED=1` as
  well, requires `application/json`, rejects foreign origins, and checks size in bytes.
  - Deferred to Release 2: authentication and a durable rate limit.
- **The title, question and history reached the model unneutralised or unredacted.** The whole
  context block and all free text are now neutralised and redacted.
- **Redaction missed common cases.** Added more TLDs, country codes and IPv6.
- **Smaller fixes:** stored state is now schema-validated, CSV escaping catches formula characters
  after leading whitespace, ESLint also bans `innerHTML`, `insertAdjacentHTML` and `document.write`,
  and the injection detector also watches the `finding_context` delimiter.

**code-reviewer** (10 findings):

- **Proposals got orphaned** when the drawer closed. They are now listed as "Pending from an earlier
  conversation".
- **A proposal could still arrive after Stop.** Those are now discarded.
- **Tab could skip the table.** When the roving row was virtualised away, no row was tabbable. There
  is now a fallback tab stop, and a new E2E test drives it with real Tab presses.
- **The SDK retry budget (about 50 s) exceeded the 30 s function limit.** Now one attempt with a 25 s
  timeout.
- **The SSE stream had no cancellation or backpressure.** The body is now pull-based and cancels the
  model stream on disconnect.
- **History could include unanswered questions.** It is now built from answered question/answer
  pairs only, trimmed in pairs.
- **Two tabs could overwrite each other's actions and reuse ticket numbers.** A `storage` event
  listener now keeps tabs in sync.
- **A drag-select released outside the drawer closed it.** The backdrop now needs both press and
  release on itself.

## 8. Guardrails verified in real Claude Code sessions

Headless `claude -p` runs inside the repo:

1. **Plain request to `cat .env.local`.** Claude refused, citing the `CLAUDE.md` rule, before any tool
   ran. The run also showed that an **untrusted** workspace ignores project permission settings,
   which is now documented.
2. **Explicitly authorised attempt** (with `--settings .claude/settings.json`):
   - The `Read` of `.env.local` was denied by the permission rule.
   - `cat .env.local` was blocked by the hook: `Blocked by .claude/hooks/guard-secrets.mjs: ".env.local" looks like a secret file…`
   - Cost: about $0.07.
3. **Stop hook.** Claude was asked to append a line with a type error and stop. The Stop hook ran
   `check:fast`, blocked the stop, and Claude removed the line. A diff confirmed the file was
   restored. Cost: about $0.12.

The dummy `.env.local` used in these runs held no real secret and was deleted afterwards.

## 9. Results

| Gate                                          | Result                                                    |
| --------------------------------------------- | --------------------------------------------------------- |
| Unit + contract tests (Vitest)                | 146 passed                                                |
| Hook tests (`node:test`)                      | 11 passed                                                 |
| E2E + axe + perf (Chromium desktop + Pixel 7) | 48 passed, 1 skipped (CVSS column hidden on mobile)       |
| E2E on Firefox + WebKit (local run)           | 46 passed, 2 skipped (perf needs Chromium CPU throttling) |
| Initial JS                                    | ~131 KiB gzip (budget 250)                                |
| Filter-to-render, 10k rows, 4× CPU            | median ~48 ms (budget 200)                                |
| `npm audit`                                   | 0 vulnerabilities                                         |

**Not done yet (honest gaps):**

- **Manual screen-reader pass (VoiceOver/NVDA).** Automated axe scans, the static audit and a scripted
  keyboard path are not a substitute.
- **Live mode has never run against the real API in this session.** Only the fake stream factory was
  used, because no key was configured.
- **Release 2 items:** Storybook, the dashboard and the attack-path view.
