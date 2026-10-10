# Performance budgets

Measured on an Apple Silicon laptop, headless Chromium, production build (`vite preview`).

| Budget                                       | Target                          | How it is checked                                    | Latest                     |
| -------------------------------------------- | ------------------------------- | ---------------------------------------------------- | -------------------------- |
| Initial JS (gzip)                            | ≤ 250 KiB                       | `npm run size` in CI (`size-limit`)                  | ~131 KiB                   |
| Filter-to-render, 1.2k rows, 4× CPU throttle | median ≤ 200 ms                 | `e2e/perf.spec.ts` (writes `test-results/perf.json`) | median ~24 ms, max ~29 ms  |
| Rendered table rows                          | ≤ 50 regardless of dataset size | `e2e/queue.spec.ts`                                  | 50                         |
| Dataset payload                              | informational                   | printed by `npm run data`                            | 614 KiB raw / ~55 KiB gzip |

## What makes it fast

- **Paginated native table** (50 rows per page, `page` in the URL): DOM size is constant, with real
  table semantics (`aria-rowcount`/`aria-rowindex` span all pages).
- **Work moved out of render:** risk score, priority and a lower-cased search haystack are computed once
  at load; filter + sort is one pure function over arrays (`selectRows`).
- **Deferred rendering:** the 1.2k-row recompute runs under `useDeferredValue`, so chip clicks and typing
  paint immediately; search input is debounced 150 ms before touching the URL.
- **Memoised rows** (`React.memo`) with stable callbacks, so a selection change re-renders one row.
- **Code splitting:** the drawer (markdown renderer, AI panel) is a lazy chunk loaded on first open.

## Known limits / next steps

- The whole dataset ships as one JSON file. A real backend would page and filter server-side; the
  next step here would be a columnar or paged payload and moving parse + filter into a Web Worker.
- Measurements are on a fast laptop; the 4× throttle approximates a mid-range device but is not one.
