# Performance budgets

Measured on an Apple Silicon laptop, headless Chromium, production build (`vite preview`).

| Budget                                      | Target                          | How it is checked                                    | Latest                     |
| ------------------------------------------- | ------------------------------- | ---------------------------------------------------- | -------------------------- |
| Initial JS (gzip)                           | ≤ 250 KiB                       | `npm run size` in CI (`size-limit`)                  | ~131 KiB                   |
| Filter-to-render, 10k rows, 4× CPU throttle | median ≤ 200 ms                 | `e2e/perf.spec.ts` (writes `test-results/perf.json`) | median ~48 ms, max ~64 ms  |
| Rendered table rows                         | ≤ 40 regardless of dataset size | `e2e/queue.spec.ts`                                  | ~18–26                     |
| Dataset payload                             | informational                   | printed by `npm run data`                            | 4.9 MB raw / ~540 KiB gzip |

## What makes it fast

- **Virtualised native table** (`@tanstack/react-virtual` + spacer rows): DOM size is constant.
  `overflow-anchor: none` on the scroller — browser scroll anchoring otherwise "compensates" for the
  growing top spacer and doubles programmatic jumps (found by the focus-restore E2E test).
- **Work moved out of render:** risk score, priority and a lower-cased search haystack are computed once
  at load; filter + sort is one pure function over arrays (`selectRows`).
- **Deferred rendering:** the 10k-row recompute runs under `useDeferredValue`, so chip clicks and typing
  paint immediately; search input is debounced 150 ms before touching the URL.
- **Memoised rows** (`React.memo`) with stable callbacks, so a selection change re-renders one row.
- **Code splitting:** the drawer (markdown renderer, AI panel) is a lazy chunk loaded on first open.

## Known limits / next steps

- The whole dataset ships as one JSON file. A real backend would page and filter server-side; the
  next step here would be a columnar or paged payload and moving parse + filter into a Web Worker.
- Measurements are on a fast laptop; the 4× throttle approximates a mid-range device but is not one.
