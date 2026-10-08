import { describe, expect, it } from 'vitest';
import { findingSchema } from './finding.ts';
import { INJECTED_SCANNER_TEXT, findFindingById, generateFindings } from './generate.ts';

describe('generateFindings', () => {
  const rows = generateFindings();

  it('is deterministic for a seed', () => {
    expect(generateFindings(50)).toEqual(generateFindings(50));
  });

  it('produces valid, uniquely identified rows', () => {
    expect(rows).toHaveLength(10_000);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    for (const row of rows.slice(0, 200)) expect(() => findingSchema.parse(row)).not.toThrow();
  });

  it('seeds every injection sample exactly once', () => {
    for (const text of INJECTED_SCANNER_TEXT) {
      expect(rows.filter((r) => r.scannerText === text)).toHaveLength(1);
    }
  });

  it('looks findings up by id on the server', () => {
    expect(findFindingById('DEMO-2026-00001')).toEqual(rows[0]);
    expect(findFindingById('DEMO-2026-99999')).toBeUndefined();
  });
});
