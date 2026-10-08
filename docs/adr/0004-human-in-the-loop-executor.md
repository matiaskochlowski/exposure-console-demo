# ADR 0004 — Client-side, simulated, human-approved action executor

**Status:** accepted

**Context.** The demo must show what happens after a person approves an AI proposal, without a real
ticketing system or backend database.

**Decision.** A pure reducer (`src/actions/executor.ts`) applies approved actions as overrides on top of
the static dataset; a tiny external store persists them to `localStorage` with a “Reset demo” control.
Tickets (`SIM-####`) and risk acceptances are labelled simulated.

**Consequences.**

- Every invariant is unit-tested: no mutation before approval, reject is a no-op, edits re-validated,
  double approval executes once, invalid transitions fail with a message.
- No server executes actions, so the server never treats a proposal as authorisation. A real
  integration would move execution server-side with its own authorisation check per action.
- State is per browser; nothing is shared between viewers.
