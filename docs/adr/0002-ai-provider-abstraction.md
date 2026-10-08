# ADR 0002 — Provider abstraction with a deterministic mock

**Status:** accepted

**Context.** The public demo must work without credentials, tests must be deterministic, and the live
path must not silently degrade into scripted output.

**Decision.** One `AssistantProvider` interface emitting the event protocol in `src/shared/stream.ts`
(`start`, `text`, `tool_proposal`, `error`, `done`). Implementations: a scripted mock (same context and
rules as the live prompt), an HTTP/SSE client, and a live-with-fallback wrapper. `VITE_AI_MODE` selects
the mode explicitly; fallback to mock happens **only** on `503 provider_unavailable` before any event.

**Consequences.**

- UI and tests are provider-agnostic; transport failures (truncation, timeout, abort, invalid frames,
  stale request ids) are tested without a model.
- Auth, rate-limit and mid-stream failures stay visible to the user.
- The mock is not an LLM; it demonstrates the contract and UX, and says so in every answer.
