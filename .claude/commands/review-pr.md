---
description: Review the current branch against main with the read-only reviewer subagents
argument-hint: '[focus area]'
---

1. Get the changed files with `git diff --name-only main...HEAD`.
2. Ask the `code-reviewer` subagent to review them. If any file is under `src/ai`, `src/shared`,
   `src/features/assistant` or `api/`, also ask the `security-reviewer`; if any `.tsx` changed, also
   ask the `a11y-auditor`. Run them in parallel. Extra focus from the user: $ARGUMENTS
3. Merge the findings, drop duplicates, rank by severity, and present them. Do not edit files.
