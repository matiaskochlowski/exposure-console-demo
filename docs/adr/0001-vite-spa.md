# ADR 0001 — Vite SPA with a thin serverless API

**Status:** accepted

**Context.** The demo is a data-heavy, client-interactive console (virtualised queue, drawer, streaming
panel). It needs one small server capability: calling a model provider with a secret key.

**Decision.** Vite + React 19 single-page app, React Router, deployed to Vercel as static assets plus
two Node functions under `api/`. Dependencies pinned to versions with known-stable APIs (Vite 7,
TypeScript 5.9, React Router 7, TanStack Virtual 3, Zod 4) rather than the newest majors.

**Consequences.**

- Fast static hosting, previews per PR, no server rendering to reason about.
- SPA deep links need a rewrite (`vercel.json`) that excludes `/api`, `/assets` and `/data`.
- TanStack Table was planned but dropped: filtering/sorting is a single tested pure function, and the
  table needed custom virtualisation and keyboard semantics anyway.
