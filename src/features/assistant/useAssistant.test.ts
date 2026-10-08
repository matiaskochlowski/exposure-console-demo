import { describe, expect, it } from 'vitest';
import { boundHistory } from '../../shared/assist.js';
import { answeredPairs, type Turn } from './useAssistant.js';

const t = (role: Turn['role'], content: string, state: Turn['state'] = 'done'): Turn => ({
  id: content,
  role,
  content,
  requestId: 'r',
  state,
});

describe('answeredPairs', () => {
  it('keeps only questions whose answers completed', () => {
    const turns = [
      t('user', 'q1'),
      t('assistant', 'a1'),
      t('user', 'q2'),
      t('assistant', '', 'error'),
      t('user', 'q3'),
      t('assistant', 'partial', 'stopped'),
    ];
    expect(answeredPairs(turns)).toEqual([
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
    ]);
  });
});

describe('boundHistory', () => {
  it('never starts with an assistant turn after trimming', () => {
    const history = Array.from({ length: 8 }, (_, i) => ({
      role: i % 2 ? ('assistant' as const) : ('user' as const),
      content: `${i}`,
    }));
    const bounded = boundHistory(history.slice(1));
    expect(bounded[0]?.role).toBe('user');
  });
});
