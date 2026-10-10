import { z } from 'zod';
import {
  DOMAINS,
  ENVIRONMENTS,
  PRIORITIES,
  STATUSES,
  type Priority,
} from '../../shared/finding.js';
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
  domain: csvOf(DOMAINS),
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
  /** 1-based page number; clamped against the result count at render time. */
  page: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number.parseInt(v ?? '', 10);
      return Number.isFinite(n) && n > 1 ? Math.min(n, 100_000) : 1;
    }),
});

export const PAGE_SIZE = 50;

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export type Filters = z.output<typeof filtersSchema>;
export const DEFAULT_FILTERS: Filters = filtersSchema.parse({});

export function parseFilters(params: URLSearchParams): Filters {
  return filtersSchema.parse(Object.fromEntries(params));
}

/** Serialise only non-default values so URLs stay short and shareable. */
export function serializeFilters(filters: Filters): URLSearchParams {
  const out = new URLSearchParams();
  if (filters.q) out.set('q', filters.q);
  for (const key of ['priority', 'status', 'env', 'domain'] as const)
    if (filters[key].length) out.set(key, filters[key].join(','));
  if (filters.kev) out.set('kev', '1');
  if (filters.validated) out.set('validated', '1');
  if (filters.sort !== 'risk') out.set('sort', filters.sort);
  if (filters.dir !== 'desc') out.set('dir', filters.dir);
  if (filters.page > 1) out.set('page', String(filters.page));
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
  const domain = f.domain.length ? new Set(f.domain) : null;
  const out = rows.filter(
    (r) =>
      (!q || r.searchText.includes(q)) &&
      (!priority || priority.has(r.priority)) &&
      (!status || status.has(r.effectiveStatus)) &&
      (!env || env.has(r.environment)) &&
      (!domain || domain.has(r.domain)) &&
      (!f.kev || r.kev) &&
      (!f.validated || r.exploitValidated),
  );
  const compare = COMPARATORS[f.sort];
  const sign = f.dir === 'asc' ? 1 : -1;
  // Stable tie-break on id keeps row order (and focus) predictable between renders.
  return out.sort((a, b) => sign * compare(a, b) || a.id.localeCompare(b.id));
}
