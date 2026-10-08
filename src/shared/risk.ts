import type { Finding, Priority } from './finding.ts';

/** Inputs to the risk score, documented in docs/glossary.md. */
export type RiskInputs = Pick<
  Finding,
  'cvss' | 'epss' | 'kev' | 'exploitValidated' | 'assetCriticality'
>;

export const RISK_WEIGHTS = {
  cvss: 0.35,
  epss: 0.25,
  kev: 0.15,
  exploitValidated: 0.15,
  assetCriticality: 0.1,
} as const;

export const PRIORITY_THRESHOLDS: ReadonlyArray<readonly [Priority, number]> = [
  ['P1', 0.75],
  ['P2', 0.55],
  ['P3', 0.35],
];

/** Weighted 0–1 score. Every chart, sort and analyst explanation uses this one function. */
export function riskScore(f: RiskInputs): number {
  const score =
    (f.cvss / 10) * RISK_WEIGHTS.cvss +
    f.epss * RISK_WEIGHTS.epss +
    (f.kev ? 1 : 0) * RISK_WEIGHTS.kev +
    (f.exploitValidated ? 1 : 0) * RISK_WEIGHTS.exploitValidated +
    (f.assetCriticality / 4) * RISK_WEIGHTS.assetCriticality;
  return Math.round(score * 1000) / 1000;
}

export function priorityFor(score: number): Priority {
  for (const [priority, min] of PRIORITY_THRESHOLDS) if (score >= min) return priority;
  return 'P4';
}

/** Human-readable reasons, strongest first, for the analyst and the drawer. */
export function riskDrivers(f: RiskInputs): string[] {
  const drivers: Array<[number, string]> = [
    [(f.cvss / 10) * RISK_WEIGHTS.cvss, `CVSS ${f.cvss.toFixed(1)}`],
    [f.epss * RISK_WEIGHTS.epss, `EPSS ${(f.epss * 100).toFixed(1)}% exploitation probability`],
  ];
  if (f.kev) drivers.push([RISK_WEIGHTS.kev, 'listed as known exploited (KEV)']);
  if (f.exploitValidated)
    drivers.push([RISK_WEIGHTS.exploitValidated, 'exploit validated against this asset']);
  drivers.push([
    (f.assetCriticality / 4) * RISK_WEIGHTS.assetCriticality,
    `asset criticality ${f.assetCriticality}/4`,
  ]);
  return drivers.sort((a, b) => b[0] - a[0]).map(([, label]) => label);
}
