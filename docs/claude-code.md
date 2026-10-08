# Claude Code setup

Recorded against **Claude Code 2.1.295**. Settings follow the published schema
(`https://json.schemastore.org/claude-code-settings.json`), and hook input/output follows the hooks
reference (`https://code.claude.com/docs/en/hooks`).

## Layers

| Layer            | File                                    | What it does                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instructions     | `CLAUDE.md` (+ `AGENTS.md` pointer)     | Commands, folder map, non-negotiable rules. Loaded first in every session                                                                                                                                                                                                                                                                     |
| Permissions      | `.claude/settings.json` → `permissions` | **allow:** `git status/diff/log`, fixed npm scripts (lint, typecheck, tests, build): no wildcard `npx` or `git diff` forms · **ask:** installs, commits, pushes, PR merges, Vercel, Playwright MCP · **deny:** `.env*`, `.vercel/`, `~/.ssh`, `curl`/`wget`, `vercel env pull`, force-push, `rm -rf`                                          |
| PreToolUse hook  | `.claude/hooks/guard-secrets.mjs`       | Blocks Read/Edit/Grep/Bash calls that touch secret-looking files (`.env*` except `.env.example`, keys, `.npmrc`, credentials) or dump the environment (`printenv`, `process.env`, `/proc/*/environ`). Strips shell quoting/escapes and catches globs like `.e*`. **Fails closed** on unreadable input. Exit code 2 sends the reason to Claude |
| PostToolUse hook | `.claude/hooks/format-lint.mjs`         | Runs Prettier, then `eslint --fix`, on the edited file only. Uses installed binaries (never `npx` downloads) and argument arrays (no shell). Skips generated, vendored and outside paths. If Prettier can't parse a half-finished edit, it stays quiet. Remaining lint errors go back to Claude                                               |
| Stop hook        | `.claude/hooks/stop-check.mjs`          | If source files changed, runs `npm run check:fast` (typecheck + unit tests) and blocks the stop with the failure output. It honours `stop_hook_active`, so it blocks at most once in a row and never loops                                                                                                                                    |
| Skills           | `.claude/skills/*/SKILL.md`             | Repeatable workflows: wireframe → component, tests, a11y audit, perf pass, FE security review, PR prep, adding an AI action                                                                                                                                                                                                                   |
| Subagents        | `.claude/agents/*.md`                   | `code-reviewer`, `security-reviewer`, `a11y-auditor`. **Read/Grep/Glob only**: no Bash, no MCP, no write tools                                                                                                                                                                                                                                |
| Commands         | `.claude/commands/*.md`                 | `/check` (full gate) and `/review-pr` (parallel reviewers on the branch diff)                                                                                                                                                                                                                                                                 |
| MCP              | `.mcp.json`                             | `@playwright/mcp@0.0.83`, pinned, headless, isolated profile, origins limited to localhost dev/preview ports. Usage requires approval (`ask`)                                                                                                                                                                                                 |

The hooks have their own tests: `npm run test:hooks` feeds sample hook JSON to each script.

## Boundaries: what this does not guarantee

- **Hooks and deny rules are guardrails, not a sandbox.** Path matching cannot see every indirect
  read. For example, a test script that opens `.env.local` itself would not be caught. For untrusted
  code or dependencies, run Claude Code with its sandbox enabled (`/sandbox`) or inside a devcontainer
  that holds no credentials.
- **Allowing a test runner allows arbitrary code.** `npm test` and `npm run test:e2e` execute
  whatever test files exist, including ones the agent just wrote. The guard sees command text, not
  what that code does at runtime. That's accepted here because the repo holds no secrets beyond an
  optional `.env.local`. Don't copy this allow-list into a repo with real credentials on disk.
- `git diff`/`git show` with arbitrary arguments were removed from the allow-list after the security
  review showed `git diff --no-index /dev/null .e''nv.local` could print a secret without a prompt.
- The secret patterns are conservative heuristics. A file named unusually would get through, and
  `.env.example.bak` is blocked on purpose (unknown content).
- Project settings and hooks only apply once the workspace is **trusted**. In an untrusted checkout,
  Claude Code ignores the project allow-list (observed while verifying, see BUILD-LOG).
- Reviewer subagents are advisory. Merges still need a human and green CI.

## Verifying it yourself

```bash
npm run test:hooks                                   # unit-level
claude -p "Make one attempt to read .env.local, then report what happened" \
  --settings .claude/settings.json --allowedTools Read "Bash(cat:*)"
```

Expected result: the Read is denied by the permission rule, and a Bash `cat` is blocked by
`guard-secrets.mjs` with the reason shown.
