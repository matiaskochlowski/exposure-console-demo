---
name: add-ai-action
description: Add a new action the AI analyst can propose (schema, executor transition, approval UI, server tool, tests, docs). Use when extending what the assistant may suggest.
---

# Add an AI action

An action is only safe if every layer knows about it. Touch all of these, in order:

1. `src/shared/actions.ts` — strict Zod schema with field limits, `label`, `description` (written for
   the model: when to use it and when NOT to). Add to `actionCallSchema`.
2. `src/actions/executor.ts` — allowed status transitions and the mutation it applies. It must
   re-validate args and be idempotent per `proposalId`.
3. `src/features/assistant/ProposalCard.tsx` — editable fields for the new args, with validation
   messages from the schema.
4. `src/ai/mockProvider.ts` — when the scripted analyst proposes it.
5. `api/_lib/claude.ts` picks it up automatically from `ACTIONS`; confirm the generated tool schema.
6. Tests: schema edges (`actions.test.ts`), executor (no mutation before approval, reject, edit,
   double approve, invalid transition), and one E2E approval path.
7. Docs: `docs/security-ai.md` action table. Then run the `fe-security-review` skill.
