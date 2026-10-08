---
name: perf-pass
description: Measure and improve rendering and bundle performance against the budgets in docs/perf.md. Use when a change touches the queue, data loading, or adds a dependency.
---

# Performance pass

**Measure first, change second, measure again.** Never memoize on a hunch.

1. Build and check the bundle: `npm run build && npm run size`. Budget: initial JS ≤ 250 KiB gzip.
   For a new dependency, report its gzip cost and whether it can be lazy-loaded.
2. Interaction timing: run `npx playwright test e2e/perf.spec.ts`; it records filter-to-render time
   for 10k rows under 4× CPU throttling. Budget ≤ 200 ms.
3. Rendering: React DevTools Profiler — look for rows re-rendering on unrelated state, unstable
   props (inline objects/functions) passed to memoized children, context consumers that update too often.
4. Fix in this order: avoid work (derive, don't store) → move work (memoized selectors, deferred
   values, workers) → reduce DOM (virtualization) → memoize.
5. Record before/after numbers, environment and method in `docs/perf.md` and the PR.
