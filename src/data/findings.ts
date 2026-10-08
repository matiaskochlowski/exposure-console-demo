import { findingSchema, type Finding, type Priority, type Status } from '../shared/finding.js';
import { priorityFor, riskScore } from '../shared/risk.js';
import type { FindingOverride } from '../actions/types.js';

/** A finding plus derived fields; immutable once loaded. */
export interface BaseRow extends Finding {
  riskScore: number;
  computedPriority: Priority;
  /** Lower-cased haystack for the search box, computed once at load. */
  searchText: string;
}

/** What the UI renders: base row with any approved actions applied. */
export interface Row extends BaseRow {
  effectiveStatus: Status;
  priority: Priority;
  priorityOverridden: boolean;
  priorityReason?: string;
  ticketId?: string;
  riskAcceptedUntil?: string;
}

function enrich(f: Finding): BaseRow {
  const score = riskScore(f);
  return {
    ...f,
    riskScore: score,
    computedPriority: priorityFor(score),
    searchText: `${f.id} ${f.title} ${f.cwe} ${f.hostname}`.toLowerCase(),
  };
}

export function toRow(base: BaseRow, override?: FindingOverride): Row {
  return {
    ...base,
    effectiveStatus: override?.status ?? base.status,
    priority: override?.priority ?? base.computedPriority,
    priorityOverridden: Boolean(override?.priority),
    priorityReason: override?.priorityReason,
    ticketId: override?.ticketId,
    riskAcceptedUntil: override?.riskAcceptedUntil,
  };
}

export interface Dataset {
  rows: BaseRow[];
  byId: Map<string, BaseRow>;
}

let pending: Promise<Dataset> | undefined;

/** Cached across renders so React 19 `use()` can suspend on it. */
export function loadDataset(url = '/data/findings.json'): Promise<Dataset> {
  pending ??= fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Could not load findings (${res.status})`);
      return res.json() as Promise<unknown>;
    })
    .then((json) => {
      if (!Array.isArray(json)) throw new Error('Findings payload is not a list');
      // Validate a sample: full Zod validation of 10k rows costs more than it protects here.
      for (const item of json.slice(0, 25)) findingSchema.parse(item);
      const rows = (json as Finding[]).map(enrich);
      return { rows, byId: new Map(rows.map((r) => [r.id, r])) };
    })
    .catch((error: unknown) => {
      pending = undefined; // allow retry
      throw error;
    });
  return pending;
}

export function enrichForTest(findings: Finding[]): BaseRow[] {
  return findings.map(enrich);
}
