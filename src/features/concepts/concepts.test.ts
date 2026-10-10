import { describe, expect, it } from 'vitest';
import { PRIORITY_THRESHOLDS, RISK_WEIGHTS } from '../../shared/risk.js';
import { CONCEPT_BY_ID, CONCEPTS, matchConcept } from './concepts.js';

describe('matchConcept', () => {
  it.each([
    ['What is EPSS?', 'epss'],
    ['explain cvss please', 'cvss'],
    ['why is this P1', 'priority'],
    ['what does risk accepted mean', 'risk_accepted'],
    ['how is the risk score calculated', 'risk'],
    ['what is KEV', 'kev'],
  ])('%s → %s', (question, id) => {
    expect(matchConcept(question)?.id).toBe(id);
  });

  it('prefers the longest alias (risk accepted over risk)', () => {
    expect(matchConcept('risk accepted vs risk')?.id).toBe('risk_accepted');
  });

  it('matches whole words only: "explain" does not hit the "ex" alias', () => {
    expect(matchConcept('explain this to me')).toBeUndefined();
  });

  it('returns undefined for unrelated questions', () => {
    expect(matchConcept('what is the weather')).toBeUndefined();
  });
});

describe('concept text', () => {
  it('quotes the real risk weights and thresholds', () => {
    expect(CONCEPT_BY_ID.risk.long).toContain(`${Math.round(RISK_WEIGHTS.cvss * 100)}%`);
    for (const [p, min] of PRIORITY_THRESHOLDS)
      expect(CONCEPT_BY_ID.priority.long).toContain(`${p} ≥ ${min}`);
  });

  it('has unique ids and non-empty text', () => {
    expect(new Set(CONCEPTS.map((c) => c.id)).size).toBe(CONCEPTS.length);
    for (const c of CONCEPTS) expect(c.short && c.long).toBeTruthy();
  });
});
