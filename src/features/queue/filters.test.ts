import { describe, expect, it } from 'vitest';
import { enrichForTest, toRow } from '../../data/findings.js';
import { generateFindings } from '../../shared/generate.js';
import { csvCell, toCsv } from './csv.js';
import { DEFAULT_FILTERS, parseFilters, selectRows, serializeFilters } from './filters.js';

const rows = enrichForTest(generateFindings(2000)).map((r) => toRow(r));

describe('URL filters', () => {
  it('round-trips through the query string and omits defaults', () => {
    const params = new URLSearchParams('q=jenkins&priority=P1,P2&kev=1&sort=cvss&dir=asc');
    const filters = parseFilters(params);
    expect(filters).toMatchObject({
      q: 'jenkins',
      priority: ['P1', 'P2'],
      kev: true,
      sort: 'cvss',
      dir: 'asc',
    });
    expect(serializeFilters(filters).toString()).toBe(
      'q=jenkins&priority=P1%2CP2&kev=1&sort=cvss&dir=asc',
    );
    expect(serializeFilters(DEFAULT_FILTERS).toString()).toBe('');
  });

  it('falls back to defaults for invalid values instead of breaking the page', () => {
    const filters = parseFilters(
      new URLSearchParams('priority=P9,P1&sort=hack&dir=sideways&q=' + 'x'.repeat(500)),
    );
    expect(filters).toMatchObject({ priority: ['P1'], sort: 'risk', dir: 'desc', q: '' });
  });
});

describe('selectRows', () => {
  it('combines filters', () => {
    const out = selectRows(rows, { ...DEFAULT_FILTERS, priority: ['P1', 'P2'], kev: true });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((r) => (r.priority === 'P1' || r.priority === 'P2') && r.kev)).toBe(true);
  });

  it('filters by environment and domain together, and drops unknown domains from the URL', () => {
    const filters = parseFilters(new URLSearchParams('domain=payments,bogus&env=production'));
    expect(filters.domain).toEqual(['payments']);
    expect(serializeFilters(filters).toString()).toBe('env=production&domain=payments');
    const out = selectRows(rows, filters);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((r) => r.domain === 'payments' && r.environment === 'production')).toBe(true);
  });

  it('searches id, title, CWE and hostname case-insensitively', () => {
    const target = rows[42]!;
    expect(selectRows(rows, { ...DEFAULT_FILTERS, q: target.id.toLowerCase() })).toEqual([target]);
    expect(
      selectRows(rows, { ...DEFAULT_FILTERS, q: target.hostname.toUpperCase() }).every(
        (r) => r.hostname === target.hostname,
      ),
    ).toBe(true);
  });

  it('sorts by effective priority then score, highest first, with a stable tie-break', () => {
    const out = selectRows(rows, DEFAULT_FILTERS);
    for (let i = 1; i < out.length; i++) {
      const [a, b] = [out[i - 1]!, out[i]!];
      expect(a.priority <= b.priority).toBe(true); // 'P1' < 'P2' lexically
      if (a.priority === b.priority) expect(a.riskScore >= b.riskScore).toBe(true);
    }
  });

  it('uses overridden priority and status from approved actions', () => {
    const base = enrichForTest(generateFindings(5));
    const overridden = base.map((r, i) =>
      toRow(r, i === 0 ? { priority: 'P1', status: 'risk_accepted' } : undefined),
    );
    expect(
      selectRows(overridden, { ...DEFAULT_FILTERS, status: ['risk_accepted'] }).map((r) => r.id),
    ).toContain(base[0]!.id);
    expect(selectRows(overridden, DEFAULT_FILTERS)[0]!.id).toBe(base[0]!.id);
  });

  it('does not mutate its input', () => {
    const copy = [...rows];
    selectRows(rows, { ...DEFAULT_FILTERS, sort: 'id', dir: 'asc' });
    expect(rows).toEqual(copy);
  });
});

describe('CSV export', () => {
  it.each([
    ['=HYPERLINK("http://x")', `"'=HYPERLINK(""http://x"")"`],
    ['+1+1', "'+1+1"],
    ['-2', "'-2"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['plain, with comma', '"plain, with comma"'],
    ['safe', 'safe'],
    ['  =1+1', "'  =1+1"],
  ])('neutralises %s', (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it('writes a header and one line per row', () => {
    const csv = toCsv(rows.slice(0, 3));
    expect(csv.split('\r\n')).toHaveLength(4);
    expect(csv.startsWith('id,title,priority')).toBe(true);
  });
});
