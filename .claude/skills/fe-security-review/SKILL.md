---
name: fe-security-review
description: Review front-end and API changes for XSS, unsafe rendering of LLM or scanner output, secrets in client code, prompt-injection exposure, data leaving the boundary, and dependency risk. Use on any change to src/ai, src/shared, api/, or anything that renders untrusted text.
---

# Front-end security review

Check, in order, and cite file:line for each finding:

1. **Untrusted rendering** — scanner text and model output are untrusted (ADR 0003). They must render
   as text or through `SafeMarkdown` (raw HTML skipped, only `https:` links). No
   `dangerouslySetInnerHTML` (ESLint enforces), no `href` built from untrusted input elsewhere.
2. **Data boundary** — anything sent to a provider goes through `buildFindingContext` on the server.
   No new fields without updating `EXCLUDED_FIELDS`/allowlist, the preview, and
   `docs/security-ai.md`. Client must not be able to send arbitrary records.
3. **Agency** — the model can only _propose_ actions in `src/shared/actions.ts`; execution happens
   after human approval, re-validates arguments, and is idempotent per proposal id.
4. **Prompt injection** — untrusted text stays inside the delimited block; the system prompt does not
   grant authority to it; the detector is a warning, not a gate.
5. **Secrets** — no keys in `src/` or `VITE_*` vars; `.env*` ignored; server logs carry no prompt or
   response bodies.
6. **Dependencies** — `npm audit` clean; new packages justified.

Output: findings ranked by severity with a concrete failure scenario each, then "verified safe"
items you checked. Do not edit files unless asked.
