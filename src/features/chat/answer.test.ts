import { describe, expect, it } from 'vitest';
import { answerLocally } from './answer.js';

describe('answerLocally', () => {
  it('answers a concept question from the glossary', () => {
    const a = answerLocally('What is EPSS?');
    expect(a.conceptId).toBe('epss');
    expect(a.text).toMatch(/^EPSS: .*30 days/);
  });

  it('points elsewhere when no concept matches', () => {
    const a = answerLocally('Should I patch DEMO-2026-00001 tonight?');
    expect(a.conceptId).toBeUndefined();
    expect(a.text).toMatch(/open it from Exposures and ask its AI analyst/);
  });
});
