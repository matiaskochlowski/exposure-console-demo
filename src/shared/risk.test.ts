import { describe, expect, it } from 'vitest';
import { priorityFor, riskDrivers, riskScore } from './risk.js';

const base = {
  cvss: 0,
  epss: 0,
  kev: false,
  exploitValidated: false,
  assetCriticality: 1,
} as const;

describe('riskScore', () => {
  it('is 1.0 for the worst possible finding', () => {
    expect(
      riskScore({ cvss: 10, epss: 1, kev: true, exploitValidated: true, assetCriticality: 4 }),
    ).toBe(1);
  });

  it('weights criticality at 10%', () => {
    expect(riskScore(base)).toBe(0.025);
  });

  it('ranks a KEV + validated medium above an unexploited critical', () => {
    const exploited = riskScore({
      ...base,
      cvss: 6.5,
      epss: 0.4,
      kev: true,
      exploitValidated: true,
    });
    const critical = riskScore({ ...base, cvss: 9.8, epss: 0.02 });
    expect(exploited).toBeGreaterThan(critical);
  });
});

describe('priorityFor', () => {
  it.each([
    [0.75, 'P1'],
    [0.749, 'P2'],
    [0.55, 'P2'],
    [0.35, 'P3'],
    [0.349, 'P4'],
    [0, 'P4'],
  ])('maps %s to %s', (score, expected) => {
    expect(priorityFor(score)).toBe(expected);
  });
});

describe('riskDrivers', () => {
  it('lists KEV and validation when present, strongest first', () => {
    const drivers = riskDrivers({
      cvss: 5,
      epss: 0.1,
      kev: true,
      exploitValidated: true,
      assetCriticality: 2,
    });
    expect(drivers[0]).toBe('CVSS 5.0');
    expect(drivers).toContain('listed as known exploited (KEV)');
    expect(drivers).toContain('exploit validated against this asset');
  });
});
