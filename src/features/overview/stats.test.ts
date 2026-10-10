import { describe, expect, it } from 'vitest';
import { enrichForTest, toRow } from '../../data/findings.js';
import { generateFindings } from '../../shared/generate.js';
import { overviewStats, percentChange, WEEKS } from './stats.js';

const rows = enrichForTest(generateFindings(2000)).map((r) => toRow(r));
const stats = overviewStats(rows);
const active = rows.filter((r) => r.status === 'open' || r.status === 'in_progress');

describe('overviewStats', () => {
  it('counts only open and in-progress findings as active', () => {
    expect(stats.active).toBe(active.length);
    expect(stats.p1Active).toBe(active.filter((r) => r.priority === 'P1').length);
    expect(stats.byPriority.reduce((n, p) => n + p.count, 0)).toBe(stats.active);
    expect(stats.active + stats.resolved + stats.riskAccepted).toBe(rows.length);
  });

  it('buckets first-seen dates into consecutive Monday-start weeks ending at the latest date', () => {
    expect(stats.weekly).toHaveLength(WEEKS);
    for (const w of stats.weekly) expect(new Date(`${w.start}T00:00:00Z`).getUTCDay()).toBe(1);
    const last = Date.parse(`${stats.weekly.at(-1)!.start}T00:00:00Z`);
    const asOf = Date.parse(`${stats.asOf}T00:00:00Z`);
    expect(asOf - last).toBeLessThan(7 * 86_400_000);
    expect(asOf).toBeGreaterThanOrEqual(last);
  });

  it('lists the five highest-risk active findings, highest first', () => {
    expect(stats.fixFirst).toHaveLength(5);
    const top = Math.max(...active.map((r) => r.riskScore));
    expect(stats.fixFirst[0]!.riskScore).toBe(top);
    for (const r of stats.fixFirst) expect(['open', 'in_progress']).toContain(r.effectiveStatus);
  });

  it('names weaknesses by their most common title prefix', () => {
    expect(stats.topWeaknesses.length).toBeGreaterThan(0);
    for (const w of stats.topWeaknesses) {
      expect(w.cwe).toMatch(/^CWE-\d+$/);
      expect(w.label).not.toContain(' in ');
    }
  });

  it('reflects approved status changes', () => {
    const target = active[0]!;
    const changed = rows.map((r) =>
      r.id === target.id ? { ...r, effectiveStatus: 'resolved' as const } : r,
    );
    expect(overviewStats(changed).active).toBe(stats.active - 1);
  });
});

describe('percentChange', () => {
  it('is signed and undefined without a baseline', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(80, 100)).toBe(-20);
    expect(percentChange(5, 0)).toBeUndefined();
  });
});
