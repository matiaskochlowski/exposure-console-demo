import { act, render, screen } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import { describe, expect, it } from 'vitest';
import type { AssistantProvider } from '../../ai/provider.js';
import { enrichForTest, toRow } from '../../data/findings.js';
import { generateFindings } from '../../shared/generate.js';
import { AssistantPanel } from './AssistantPanel.js';

const row = toRow(enrichForTest(generateFindings(1))[0]!);

/** A provider whose answer never finishes, so the panel stays busy. */
const hanging: AssistantProvider = {
  mode: 'mock',
  async *stream(_request, signal) {
    await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()));
    yield* []; // nothing to emit: the answer never arrives
  },
};

describe('AssistantPanel hint hand-off', () => {
  it('reports a busy analyst instead of dropping the question', async () => {
    const askRef = createRef<((q: string) => void) | null>() as RefObject<
      ((q: string) => void) | null
    >;
    render(
      <AssistantPanel row={row} provider={hanging} getBase={() => undefined} askRef={askRef} />,
    );

    await act(async () => askRef.current?.('What is CVSS?'));
    expect(screen.getByText('What is CVSS?')).toBeInTheDocument();

    await act(async () => askRef.current?.('What is EPSS?'));
    expect(screen.getByText(/still answering\. Ask “What is EPSS\?” again/)).toBeInTheDocument();
  });
});
