# Exposure Console

A front-end demo of an **exposure-management triage console**: a 1,200-finding risk queue, a
finding drawer, and an **AI analyst that proposes actions a person must approve**. It was built
end-to-end with **Claude Code**, and the repository is laid out the way an AI-enabled team would
run it: agent instructions, skills, subagents, hooks, permissions, MCP config, ADRs and a build log.

**Live demo:** https://exposure-console-demo.vercel.app · synthetic data, mock analyst, nothing to sign up for.

![Exposure queue, light theme](docs/screenshots/queue-light.png)

| AI analyst with a pending proposal (dark)           | Prompt-injection warning (mobile)                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| ![Analyst panel](docs/screenshots/analyst-dark.png) | ![Injection warning on mobile](docs/screenshots/injection-mobile-dark.png) |

## Try it in 60 seconds

1. Filter to **P1** and **Known exploited**. The URL updates, so back/forward and shared links work.
2. Open a finding (click, or focus the table and use ↑/↓ then Enter).
3. Ask the analyst **“What should we do about this?”** It streams an explanation and proposes an action.
4. **Edit** the proposed ticket, then **Approve**. The row in the queue updates (`In progress`,
   `SIM-1001`) and the drawer's activity log records it. You can also **Reject**: nothing changes.
5. Open **DEMO-2026-00008**. Its scanner output contains a prompt-injection attempt. The UI flags it,
   and the analyst declines to follow it.
6. Open **What the analyst receives** to see the exact redacted payload: hostnames, IPs and owners
   are withheld.
7. **Reset demo** clears everything.

This is a demo of a CTEM-style _prioritise → mobilise_ workflow, not a complete exposure-management
platform. Tickets and risk decisions are simulated, and all data is generated.

## What it demonstrates

| Requirement                              | Where to look                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fast, data-heavy React UI                | Virtualised **native `<table>`** over 1.2k rows (≤ 50 rows in the DOM), deferred filtering, memoised rows, lazy drawer chunk. Filter-to-render has a **median of about 24 ms at 4× CPU throttle** (`e2e/perf.spec.ts`, [`docs/perf.md`](docs/perf.md))                          |
| Accessible by default                    | Roving-tabindex table with `aria-rowcount`/`aria-sort`, native `<dialog>` drawer with focus return, polite live regions, light/dark tokens. **axe-clean in 5 named states × 2 themes × desktop/mobile**, plus a keyboard-only E2E path                                          |
| Responsive / cross-device                | Mobile-first layout, Playwright on desktop Chromium and Pixel 7 in CI; Firefox and WebKit pass locally                                                                                                                                                                          |
| Reusable component library               | `src/ui/` primitives (Button, Badge/PriorityBadge/StatusBadge, Drawer, Field, Toast) on design tokens in `src/index.css`                                                                                                                                                        |
| Testing discipline                       | **146 unit/contract tests** (Vitest + RTL) and **24 E2E specs** (Playwright + axe; 21 also on mobile) against the production build, in staged CI                                                                                                                                |
| GenAI integration with human-in-the-loop | Streaming analyst → validated **proposals** → edit/approve/reject → idempotent executor with an audit trail ([ADR 0004](docs/adr/0004-human-in-the-loop-executor.md))                                                                                                           |
| AI security                              | Server-side data boundary and redaction, delimited and neutralised untrusted text, schema-validated tool calls, injection heuristic (a warning, not a gate), safe markdown rendering, strict CSP, CSV formula-injection escaping ([`docs/security-ai.md`](docs/security-ai.md)) |
| Robust streaming                         | One SSE protocol for mock and live with abort, idle timeout, truncation detection, stale-response guard, and fallback to mock **only** on `503 provider_unavailable` ([ADR 0002](docs/adr/0002-ai-provider-abstraction.md))                                                     |
| Reusable AI assets in the repo           | `.claude/skills`, `.claude/agents`, `.claude/hooks`, `CLAUDE.md`. See below                                                                                                                                                                                                     |

## How it was built with Claude Code

```
CLAUDE.md                  agent guide: commands, map, rules
AGENTS.md                  pointer for other agents
.claude/
  settings.json            permissions (allow / ask / deny) + hook wiring
  hooks/                   guard-secrets (PreToolUse), format-lint (PostToolUse), stop-check (Stop) + tests
  skills/                  wireframe-to-component, write-tests, a11y-audit, perf-pass,
                           fe-security-review, pr-prep, add-ai-action
  agents/                  code-reviewer, security-reviewer, a11y-auditor (read-only tools)
  commands/                /check, /review-pr
.mcp.json                  Playwright MCP, pinned, headless, localhost-only origins
docs/                      conventions, testing, perf budgets, AI security policy, glossary, ADRs, BUILD-LOG
.github/                   CI (staged gates) + PR template with an "AI assistance" section
```

Verified in real headless Claude Code sessions, not just described (details in
[`docs/BUILD-LOG.md`](docs/BUILD-LOG.md)):

- Asked to read `.env.local`, Claude was stopped by **three independent layers**: the `CLAUDE.md` rule,
  the permission deny rule, and the `guard-secrets` hook.
- Asked to plant a type error and stop, the **Stop hook** ran `check:fast`, blocked the stop, and
  Claude fixed the error before it could finish.
- The three **read-only reviewer subagents** reviewed the codebase. Their findings and the fixes are in
  the PRs and the build log.

The guardrails are documented honestly: deny rules and hooks are not a sandbox
([`docs/claude-code.md`](docs/claude-code.md)).

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    Q[Queue + URL filters] --> D[Finding drawer]
    D --> P[AI panel]
    P -->|AssistantProvider| M[Mock analyst]
    P -->|AssistantProvider| H[HTTP/SSE client]
    P --> X[Proposal cards] -->|approve / edit / reject| E[Executor + store]
    E --> Q
  end
  H -->|findingId + question| A["/api/assist (Vercel)"]
  A -->|lookup by id, allowlist, redact| C[(Synthetic dataset)]
  A -->|delimited untrusted text, tool schemas| L[Claude]
  L -->|text + tool_use| A -->|validated events| H
```

`src/shared/` holds the contracts both sides import: finding schema, risk score, redaction, injection
heuristic, action schemas, stream protocol and request schema.

## Run it locally

```bash
nvm use            # Node 22
npm ci
npm run dev        # http://localhost:5173, mock analyst
npm run check      # lint, format, types, unit, hook tests, build, bundle size
npm run build && npx playwright install chromium && npx playwright test --project=chromium --project=mobile
```

Live analyst (optional): copy `.env.example` to `.env.local`, set `ANTHROPIC_API_KEY` and
`VITE_AI_MODE=live`, then run `npm run dev:full` (requires the Vercel CLI). The public deployment
stays in mock mode until access control, durable rate limiting and a spend limit are in place.

## Status

Release 1 (this repo): queue, drawer, analyst with HITL actions, guardrails, tests, CI, deployment.
Next: dashboard and charts, attack-path view with a table alternative, Storybook, Firefox/WebKit in
CI, and gated live mode.

## License

MIT. All data is synthetic, and hostnames use the reserved `example.com` domain.
