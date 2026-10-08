---
name: pr-prep
description: Prepare a pull request - run the checks, summarise the change, list risks and verification, and fill .github/pull_request_template.md. Use when a branch is ready for review.
---

# PR prep

1. `npm run check` must pass. If browser behaviour changed, `npx playwright test` too.
2. Read `git diff main...HEAD` in full. Look for leftover debug code, TODOs without an issue, and
   changes unrelated to the PR's purpose (split them out).
3. Fill the template:
   - **What & why** — two or three sentences a reviewer can read cold.
   - **How to verify** — exact commands and UI steps, including the states a reviewer should try.
   - **Risks** — what could break, what is not covered by tests, rollout notes.
   - **AI assistance** — which skills/subagents/hooks were used and what the human reviewed or changed.
4. Ask the `code-reviewer` subagent for a review of the diff and paste its findings (or "no findings")
   as a PR comment; fix or explicitly defer each one.
