import type { Row } from '../../data/findings.js';
import { PRIORITIES, type Priority } from '../../shared/finding.js';

const DAY = 86_400_000;
export const WEEKS = 26;

export interface WeekBucket {
  /** ISO date (yyyy-mm-dd) of the Monday the week starts on. */
  start: string;
  count: number;
}

export interface OverviewStats {
  /** Latest first-seen date in the data; "last 30 days" is relative to it, so the demo is stable. */
  asOf: string;
  active: number;
  p1Active: number;
  kevActive: number;
  validatedActive: number;
  newLast30: number;
  newPrev30: number;
  byPriority: Array<{ priority: Priority; count: number }>;
  topWeaknesses: Array<{ cwe: string; label: string; count: number }>;
  weekly: WeekBucket[];
  fixFirst: Row[];
  resolved: number;
  riskAccepted: number;
}

const isActive = (r: Row) => r.effectiveStatus === 'open' || r.effectiveStatus === 'in_progress';
const toDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Monday 00:00 UTC of the week containing `ms`. */
const weekStart = (ms: number) => ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY;

/** One pass over the rows; everything the Overview page shows. */
export function overviewStats(rows: readonly Row[]): OverviewStats {
  let latest = 0;
  for (const r of rows) latest = Math.max(latest, toDay(r.firstSeen));
  const last30 = latest - 30 * DAY;
  const prev30 = latest - 60 * DAY;
  const firstWeek = weekStart(latest) - (WEEKS - 1) * 7 * DAY;

  const stats = {
    active: 0,
    p1Active: 0,
    kevActive: 0,
    validatedActive: 0,
    newLast30: 0,
    newPrev30: 0,
    resolved: 0,
    riskAccepted: 0,
  };
  const byPriority = new Map<Priority, number>(PRIORITIES.map((p) => [p, 0]));
  const byCwe = new Map<string, { count: number; labels: Map<string, number> }>();
  const weekly = Array.from({ length: WEEKS }, (_, i) => ({
    start: iso(firstWeek + i * 7 * DAY),
    count: 0,
  }));
  const active: Row[] = [];

  for (const r of rows) {
    const seen = toDay(r.firstSeen);
    if (seen > last30) stats.newLast30++;
    else if (seen > prev30) stats.newPrev30++;
    const week = Math.floor((weekStart(seen) - firstWeek) / (7 * DAY));
    if (week >= 0 && week < WEEKS) weekly[week]!.count++;

    if (r.effectiveStatus === 'resolved') stats.resolved++;
    if (r.effectiveStatus === 'risk_accepted') stats.riskAccepted++;
    if (!isActive(r)) continue;
    active.push(r);
    stats.active++;
    if (r.priority === 'P1') stats.p1Active++;
    if (r.kev) stats.kevActive++;
    if (r.exploitValidated) stats.validatedActive++;
    byPriority.set(r.priority, byPriority.get(r.priority)! + 1);

    // Titles read "<weakness> in <product>"; the most common prefix names the CWE in plain words.
    const entry = byCwe.get(r.cwe) ?? { count: 0, labels: new Map<string, number>() };
    entry.count++;
    const label = r.title.split(' in ')[0]!;
    entry.labels.set(label, (entry.labels.get(label) ?? 0) + 1);
    byCwe.set(r.cwe, entry);
  }

  const topWeaknesses = [...byCwe]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([cwe, { count, labels }]) => ({
      cwe,
      count,
      label: [...labels].sort((a, b) => b[1] - a[1])[0]![0],
    }));

  const fixFirst = active
    .sort((a, b) => b.riskScore - a.riskScore || a.id.localeCompare(b.id))
    .slice(0, 5);

  return {
    asOf: iso(latest),
    ...stats,
    byPriority: PRIORITIES.map((priority) => ({ priority, count: byPriority.get(priority)! })),
    topWeaknesses,
    weekly,
    fixFirst,
  };
}

/** Signed percent change, or undefined when there is no previous period to compare with. */
export function percentChange(current: number, previous: number): number | undefined {
  if (previous === 0) return undefined;
  return Math.round(((current - previous) / previous) * 100);
}
