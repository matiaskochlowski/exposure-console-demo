import { z } from 'zod';
import { ENVIRONMENTS, PRIORITIES, STATUSES, type Priority } from '../../shared/finding.js';
import type { Row } from '../../data/findings.js';

export const SORT_KEYS = ['risk', 'cvss', 'epss', 'firstSeen', 'id'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/** Comma-separated enum list in the URL; unknown members are dropped instead of failing the page. */
const csvOf = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((raw) => [
      ...new Set(
        (raw ?? '').split(',').filter((v): v is T => (values as readonly string[]).includes(v)),
      ),
    ]);

const flag = z
  .string()
  .optional()
  .transform((v) => v === '1');

export const filtersSchema = z.object({
  q: z
    .string()
    .max(100)
    .optional()
    .catch(undefined)
    .transform((v) => v?.trim() ?? ''),
  priority: csvOf(PRIORITIES),
  status: csvOf(STATUSES),
  env: csvOf(ENVIRONMENTS),
  kev: flag,
  validated: flag,
  sort: z
    .enum(SORT_KEYS)
    .optional()
    .catch(undefined)
    .transform((v) => v ?? 'risk'),
  dir: z
    .enum(['asc', 'desc'])
    .optional()
    .catch(undefined)
    .transform((v) => v ?? 'desc'),
});

export type Filters = z.output<typeof filtersSchema>;
export const DEFAULT_FILTERS: Filters = filtersSchema.parse({});

export function parseFilters(params: URLSearchParams): Filters {
  return filtersSchema.parse(Object.fromEntries(params));
}

/** Serialise only non-default values so URLs stay short and shareable. */
export function serializeFilters(filters: Filters): URLSearchParams {
  const out = new URLSearchParams();
  if (filters.q) out.set('q', filters.q);
  for (const key of ['priority', 'status', 'env'] as const)
    if (filters[key].length) out.set(key, filters[key].join(','));
  if (filters.kev) out.set('kev', '1');
  if (filters.validated) out.set('validated', '1');
  if (filters.sort !== 'risk') out.set('sort', filters.sort);
  if (filters.dir !== 'desc') out.set('dir', filters.dir);
  return out;
}

const PRIORITY_RANK: Record<Priority, number> = { P1: 4, P2: 3, P3: 2, P4: 1 };

const COMPARATORS: Record<SortKey, (a: Row, b: Row) => number> = {
  risk: (a, b) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.riskScore - b.riskScore,
  cvss: (a, b) => a.cvss - b.cvss,
  epss: (a, b) => a.epss - b.epss,
  firstSeen: (a, b) => a.firstSeen.localeCompare(b.firstSeen),
  id: (a, b) => a.id.localeCompare(b.id),
};

/** Pure filter + sort over the whole dataset. Timed in e2e/perf.spec.ts. */
export function selectRows(rows: readonly Row[], f: Filters): Row[] {
  const q = f.q.toLowerCase();
  const priority = f.priority.length ? new Set(f.priority) : null;
  const status = f.status.length ? new Set(f.status) : null;
  const env = f.env.length ? new Set(f.env) : null;
  const out = rows.filter(
    (r) =>
      (!q || r.searchText.includes(q)) &&
      (!priority || priority.has(r.priority)) &&
      (!status || status.has(r.effectiveStatus)) &&
      (!env || env.has(r.environment)) &&
      (!f.kev || r.kev) &&
      (!f.validated || r.exploitValidated),
  );
  const compare = COMPARATORS[f.sort];
  const sign = f.dir === 'asc' ? 1 : -1;
  // Stable tie-break on id keeps row order (and focus) predictable between renders.
  return out.sort((a, b) => sign * compare(a, b) || a.id.localeCompare(b.id));
}
